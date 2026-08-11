import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/clients/prisma.service';
import { StructureExecutorService } from './structure-executor.service';
import { EngineTasksService } from './engine-tasks.service';
import { assignPersona, decideCommunityOps, PersonaEdge } from './community-ops';
import { ENGINE } from './engine-config';

/**
 * Layer [3]: the online community layer. Given the personas a refinement touched,
 * it places unassigned personas into communities (plurality of edge weight, else a
 * new community), then runs the hysteresis merge/split ops over the touched
 * communities and applies them through the executor. Every op bumps the
 * component's changeCounter; once it crosses TREE_REBUILD_DELTA a coalesced
 * encoding-tree rebuild is enqueued (the offline correction of any local drift).
 */
@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: StructureExecutorService,
    private readonly tasks: EngineTasksService,
  ) {}

  async reconcile(userId: string, affectedPersonaIds: string[]): Promise<void> {
    if (affectedPersonaIds.length === 0) return;
    const componentId = await this.ensureComponent(userId);
    const { edges, communityOf } = await this.buildPersonaGraph(affectedPersonaIds);

    // 1. place unassigned personas (new memories / re-split personas)
    let changes = 0;
    for (const personaId of affectedPersonaIds) {
      if (communityOf.get(personaId)) continue; // already assigned
      const target = assignPersona(personaId, edges, communityOf);
      if (target) {
        await this.executor.assignPersonas([personaId], target);
        communityOf.set(personaId, target);
      } else {
        const node = await this.executor.createCommunity(userId, componentId);
        await this.executor.assignPersonas([personaId], node.id);
        communityOf.set(personaId, node.id);
      }
      changes++;
    }

    // 2. hysteresis ops over the touched communities
    const frozen = await this.frozenCommunities([...new Set([...communityOf.values()].filter((c): c is string => !!c))]);
    for (const op of decideCommunityOps(edges, communityOf, frozen)) {
      if (op.kind === 'merge') {
        await this.executor.merge(userId, op.keep, op.drop);
      } else {
        const node = await this.prisma.engineNode.findUnique({ where: { id: op.community } });
        if (node) await this.executor.split(userId, node, op.groupB);
      }
      changes++;
    }

    // 3. project the touched memories' membership onto MemoryArea
    const memoryIds = await this.memoriesOfPersonas(affectedPersonaIds);
    await this.executor.syncMembership(userId, memoryIds);

    // 4. trigger a coalesced offline rebuild once the component has drifted enough
    if (changes > 0) await this.bumpAndMaybeRebuild(userId, componentId, changes);
  }

  private async ensureComponent(userId: string): Promise<string> {
    const existing = await this.prisma.engineComponent.findFirst({ where: { userId }, select: { id: true } });
    if (existing) return existing.id;
    const created = await this.prisma.engineComponent.create({ data: { userId } });
    return created.id;
  }

  private async bumpAndMaybeRebuild(userId: string, componentId: string, delta: number): Promise<void> {
    const c = await this.prisma.engineComponent.update({
      where: { id: componentId },
      data: { changeCounter: { increment: delta } },
      select: { changeCounter: true },
    });
    if (c.changeCounter >= ENGINE.TREE_REBUILD_DELTA) {
      await this.tasks.enqueueRebuild(userId, componentId);
      await this.prisma.engineComponent.update({ where: { id: componentId }, data: { changeCounter: 0 } });
    }
  }

  /** Community nodes whose Space is governance=manual → frozen (never merged/split). */
  private async frozenCommunities(nodeIds: string[]): Promise<Set<string>> {
    if (nodeIds.length === 0) return new Set();
    const nodes = await this.prisma.engineNode.findMany({
      where: { id: { in: nodeIds }, space: { governance: 'manual' } },
      select: { id: true },
    });
    return new Set(nodes.map((n) => n.id));
  }

  private async memoriesOfPersonas(personaIds: string[]): Promise<string[]> {
    const rows = await this.prisma.memoryPersona.findMany({
      where: { id: { in: personaIds } },
      select: { memoryId: true },
    });
    return [...new Set(rows.map((r) => r.memoryId))];
  }

  /**
   * Assemble the persona graph induced by the involved memories: an edge between
   * persona P (ego m, holding neighbour n) and persona Q (ego n, holding m), weight
   * = the mutual MemoryEdge weight. Scoped to the touched personas' memories and
   * their neighbours — the local view the online layer decides on.
   */
  private async buildPersonaGraph(
    personaIds: string[],
  ): Promise<{ edges: PersonaEdge[]; communityOf: Map<string, string | null> }> {
    const seedPersonas = await this.prisma.memoryPersona.findMany({
      where: { id: { in: personaIds } },
      select: { memoryId: true, neighbors: { select: { neighborId: true } } },
    });
    const involved = [
      ...new Set([
        ...seedPersonas.map((p) => p.memoryId),
        ...seedPersonas.flatMap((p) => p.neighbors.map((n) => n.neighborId)),
      ]),
    ];

    const [personaNeighbors, memoryEdges, personas] = await Promise.all([
      this.prisma.personaNeighbor.findMany({
        where: { memoryId: { in: involved } },
        select: { memoryId: true, neighborId: true, personaId: true },
      }),
      this.prisma.memoryEdge.findMany({
        where: { mutual: true, srcId: { in: involved }, dstId: { in: involved } },
        select: { srcId: true, dstId: true, weight: true },
      }),
      this.prisma.memoryPersona.findMany({
        where: { memoryId: { in: involved } },
        select: { id: true, memoryId: true, communityId: true, neighbors: { select: { neighborId: true } } },
      }),
    ]);

    const personaOf = new Map<string, string>(); // `${memoryId} ${neighborId}` → personaId
    for (const r of personaNeighbors) personaOf.set(`${r.memoryId} ${r.neighborId}`, r.personaId);
    const weightOf = new Map<string, number>();
    for (const e of memoryEdges) weightOf.set(`${e.srcId} ${e.dstId}`, e.weight);

    const communityOf = new Map<string, string | null>();
    for (const p of personas) communityOf.set(p.id, p.communityId);

    const edges: PersonaEdge[] = [];
    const seen = new Set<string>();
    for (const p of personas) {
      for (const { neighborId: n } of p.neighbors) {
        const reverse = personaOf.get(`${n} ${p.memoryId}`); // persona of n holding m
        if (!reverse || reverse === p.id) continue;
        const key = p.id < reverse ? `${p.id} ${reverse}` : `${reverse} ${p.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const w = weightOf.get(`${p.memoryId} ${n}`) ?? weightOf.get(`${n} ${p.memoryId}`) ?? 0;
        edges.push({ a: p.id, b: reverse, w });
      }
    }
    return { edges, communityOf };
  }
}
