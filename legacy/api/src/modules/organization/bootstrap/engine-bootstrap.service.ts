import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/clients/prisma.service';
import { VectorStorePort } from '../../../common/ports/vector-store.port';
import { P } from '../../../common/ports/predicate';
import { AreasService } from '../../areas/areas.service';
import { MemoryGraphService } from '../memory-graph.service';
import { PersonaService } from '../persona.service';
import { CommunityService } from '../community.service';
import { TreeBuilderService } from '../tree-builder.service';

/**
 * One-shot "clean bootstrap": reconstruct a user's whole area tree from scratch
 * with the v2 engine (graph → personas → communities → encoding tree), then
 * re-home the grants/files/fragments/lenses that hung off the OLD areas onto the
 * NEW community that holds the plurality of each old area's memories, and drop the
 * old areas. Idempotent: re-running wipes the engine state and rebuilds
 * deterministically. Runs with the app + worker down (or right after the v2 deploy).
 *
 * Re-homing rule (05 §5): grants/fragments NEVER fall back to General — a grant on
 * General would see everything (a massive scope widening). Only Files fall back to
 * General, because a File needs a home (Restrict). Grants/fragments with no
 * plurality target are dropped (their access was already meaningless once the area
 * dissolved).
 */
@Injectable()
export class EngineBootstrapService {
  private readonly logger = new Logger(EngineBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectors: VectorStorePort,
    private readonly areas: AreasService,
    private readonly graph: MemoryGraphService,
    private readonly personas: PersonaService,
    private readonly communities: CommunityService,
    private readonly treeBuilder: TreeBuilderService,
  ) {}

  async bootstrapAll(): Promise<void> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    this.logger.log(`bootstrapping ${users.length} users`);
    for (const { id } of users) {
      await this.bootstrapUser(id).catch((e) => this.logger.error(`bootstrap ${id}: ${(e as Error).message}`));
    }
  }

  async bootstrapUser(userId: string): Promise<void> {
    await this.areas.ensureGeneral(userId);
    // ALL non-General Spaces are "old" — snapshot each with its live memories BEFORE
    // the rebuild, because syncMembership rewrites (clears) their MemoryArea rows. On
    // a re-run this also captures the previous run's community/internal Spaces, so
    // the whole thing is idempotent (drop everything old, rebuild fresh).
    const oldAreas = await this.prisma.space.findMany({
      where: { ownerUserId: userId, isDefault: false },
      select: { id: true },
    });
    const oldAreaMemories = new Map<string, string[]>();
    for (const a of oldAreas) {
      const rows = await this.prisma.memoryArea.findMany({ where: { spaceId: a.id }, select: { memoryId: true } });
      oldAreaMemories.set(a.id, rows.map((r) => r.memoryId));
    }

    await this.wipeEngineState(userId);
    await this.rebuildGraph(userId);

    const memoryIds = await this.liveMemoryIds(userId);
    const personaIds = await this.personas.recompute(userId, memoryIds);
    await this.communities.reconcile(userId, personaIds);

    const component = await this.prisma.engineComponent.findFirst({ where: { userId }, select: { id: true } });
    if (component) await this.treeBuilder.rebuild(userId, component.id);

    await this.rehomeAndDropOldAreas(userId, oldAreaMemories);
    this.logger.log(`bootstrapped user ${userId} (${memoryIds.length} memories, ${oldAreas.length} old areas)`);
  }

  /** Clear the engine's private state. Community Spaces survive (dropped via the
   *  oldAreas snapshot instead) — EngineComponent's cascade drops their EngineNode
   *  but never the Space itself. */
  private async wipeEngineState(userId: string): Promise<void> {
    await this.prisma.memoryEdge.deleteMany({ where: { userId } });
    await this.prisma.memoryPersona.deleteMany({ where: { userId } });
    await this.prisma.engineComponent.deleteMany({ where: { userId } });
    await this.prisma.engineTask.deleteMany({ where: { userId } });
  }

  private async rebuildGraph(userId: string): Promise<void> {
    const page = await this.vectors.scroll(P.own(userId), {
      withVectors: true,
      limit: 100_000,
    });
    for (const point of page.points) {
      if (point.vector?.length) await this.graph.insert(point.id, userId, point.vector);
    }
  }

  private async liveMemoryIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.memoryIndex.findMany({
      where: { authorUserId: userId, supersededBy: null },
      select: { memoryId: true },
    });
    return rows.map((r) => r.memoryId);
  }

  private async rehomeAndDropOldAreas(userId: string, oldAreaMemories: Map<string, string[]>): Promise<void> {
    const general = await this.areas.ensureGeneral(userId);
    for (const [oldId, memoryIds] of oldAreaMemories) {
      const target = (await this.pluralityCommunitySpace(memoryIds)) ?? null;

      // Grants: reconcile includeSensitive collisions, then move (or drop if no target).
      if (target) {
        await this.rehomeGrants(oldId, target);
        await this.prisma.fragmentShare.updateMany({ where: { spaceId: oldId }, data: { spaceId: target } });
      } else {
        await this.prisma.grant.deleteMany({ where: { spaceId: oldId } });
        await this.prisma.fragmentShare.deleteMany({ where: { spaceId: oldId } });
      }
      // Files always need a home (Restrict) → target or General.
      await this.prisma.file.updateMany({ where: { spaceId: oldId }, data: { spaceId: target ?? general.id } });
      // Lenses reference Space ids without an FK → drop the dead id from their arrays.
      await this.remapLensSources(userId, oldId, target);
      // MemoryArea rows to the old area are stale (membership was rebuilt) → remove (Restrict).
      await this.prisma.memoryArea.deleteMany({ where: { spaceId: oldId } });
      await this.prisma.space.updateMany({ where: { parentId: oldId }, data: { parentId: target ?? general.id } });
      await this.prisma.space.delete({ where: { id: oldId } }).catch(() => undefined);
    }
  }

  /** The new community Space holding the plurality of the given memories. */
  private async pluralityCommunitySpace(memoryIds: string[]): Promise<string | undefined> {
    if (memoryIds.length === 0) return undefined;
    const personas = await this.prisma.memoryPersona.findMany({
      where: { memoryId: { in: memoryIds }, communityId: { not: null } },
      select: { community: { select: { spaceId: true } } },
    });
    const count = new Map<string, number>();
    for (const p of personas) {
      const s = p.community?.spaceId;
      if (s) count.set(s, (count.get(s) ?? 0) + 1);
    }
    let best: string | undefined;
    let bestN = 0;
    for (const [space, n] of [...count].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (n > bestN) {
        bestN = n;
        best = space;
      }
    }
    return best;
  }

  /** Move grants off `oldId` onto `target`, reconciling includeSensitive collisions. */
  private async rehomeGrants(oldId: string, target: string): Promise<void> {
    const [oldGrants, targetGrants] = await Promise.all([
      this.prisma.grant.findMany({ where: { spaceId: oldId } }),
      this.prisma.grant.findMany({ where: { spaceId: target } }),
    ]);
    const targetByConn = new Map(targetGrants.map((g) => [g.connectionId, g]));
    const colliding: string[] = [];
    for (const og of oldGrants) {
      const tg = targetByConn.get(og.connectionId);
      if (!tg) continue;
      colliding.push(og.connectionId);
      if (og.includeSensitive && !tg.includeSensitive) {
        await this.prisma.grant.update({ where: { id: tg.id }, data: { includeSensitive: true } });
      }
    }
    if (colliding.length) {
      await this.prisma.grant.deleteMany({ where: { spaceId: oldId, connectionId: { in: colliding } } });
    }
    await this.prisma.grant.updateMany({ where: { spaceId: oldId }, data: { spaceId: target } });
  }

  private async remapLensSources(userId: string, oldId: string, target: string | null): Promise<void> {
    const lenses = await this.prisma.lens.findMany({
      where: { userId, sourceAreaIds: { has: oldId } },
      select: { id: true, sourceAreaIds: true },
    });
    for (const lens of lenses) {
      const mapped = lens.sourceAreaIds.map((s) => (s === oldId ? target : s)).filter((s): s is string => !!s);
      await this.prisma.lens.update({ where: { id: lens.id }, data: { sourceAreaIds: [...new Set(mapped)] } });
    }
  }
}
