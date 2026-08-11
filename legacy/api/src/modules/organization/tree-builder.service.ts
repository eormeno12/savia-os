import { Injectable, Logger } from '@nestjs/common';
import type { EngineNode, Space } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { AreasService } from '../areas/areas.service';
import { StructureExecutorService } from './structure-executor.service';
import { WeightedGraph, emptyGraph, addEdge } from './graph';
import { buildEncodingTree, EncodingTreeNode } from './structural-entropy';

/**
 * Layer [4]: the offline encoding-tree rebuild (HISEvent). Given a component it
 * builds the community graph (vertices = leaf communities, edges = inter-community
 * mutual-edge weight), minimizes structural entropy into a hierarchy, and reshapes
 * the Space tree to match.
 *
 * Design rule that keeps this simple AND correct: INTERNAL Spaces are engine-owned,
 * ephemeral containers — they are never grant targets (to share a grouping durably
 * a user PINS it → governance=manual → it leaves the engine's scope and is treated
 * as a frozen leaf). So the internal structure is rebuilt from scratch each pass,
 * deterministically (same graph ⇒ same tree ⇒ no churn), while LEAF communities
 * (which can carry grants) keep their identity and are only re-parented. Membership
 * is re-projected afterward, so every memory's area_ids reflect the new ancestors.
 */
@Injectable()
export class TreeBuilderService {
  private readonly logger = new Logger(TreeBuilderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly areas: AreasService,
    private readonly executor: StructureExecutorService,
  ) {}

  async rebuild(userId: string, componentId: string): Promise<void> {
    const communities = await this.prisma.engineNode.findMany({
      where: { componentId, kind: 'community' },
      include: { space: true },
    });
    if (communities.length < 2) return; // nothing to nest

    const graph = await this.buildCommunityGraph(componentId, communities);
    const tree = buildEncodingTree(graph);
    const general = await this.areas.ensureGeneral(userId);

    const oldInternal = await this.prisma.engineNode.findMany({
      where: { componentId, kind: 'internal' },
      select: { id: true, spaceId: true },
    });

    // Build the fresh internal structure and re-parent leaves under it.
    await this.materialize(userId, componentId, tree, communities, general.id);

    // Drop the now-orphaned old internal Spaces (grant-free by rule; their leaves
    // were just re-parented onto the fresh structure). Remove their stale MemoryArea
    // rows first (Restrict), then the Space (cascades the EngineNode).
    for (const node of oldInternal) {
      await this.prisma.memoryArea.deleteMany({ where: { spaceId: node.spaceId } });
      await this.prisma.space.delete({ where: { id: node.spaceId } }).catch(() => undefined);
    }

    await this.areas.reindexFrom(general.id);
    const memoryIds = await this.componentMemoryIds(communities.map((c) => c.id));
    await this.executor.syncMembership(userId, memoryIds); // re-project closure with new ancestors
    this.logger.log(`rebuilt encoding tree for component ${componentId} (${communities.length} communities)`);
  }

  /** One vertex per leaf community; edge weight = Σ mutual-edge weight whose two
   *  endpoints' personas fall in the two different communities. */
  private async buildCommunityGraph(
    componentId: string,
    communities: (EngineNode & { space: Space })[],
  ): Promise<WeightedGraph> {
    const nodeIndex = new Map<string, number>();
    communities.forEach((c, i) => nodeIndex.set(c.id, i));

    const personas = await this.prisma.memoryPersona.findMany({
      where: { community: { componentId } },
      include: { neighbors: { select: { neighborId: true } } },
    });
    const communityOfPersona = new Map<string, string>();
    const personaByEgoNeighbor = new Map<string, string>();
    const memoryIds = new Set<string>();
    for (const p of personas) {
      if (p.communityId) communityOfPersona.set(p.id, p.communityId);
      memoryIds.add(p.memoryId);
      for (const n of p.neighbors) personaByEgoNeighbor.set(`${p.memoryId} ${n.neighborId}`, p.id);
    }

    const edges = await this.prisma.memoryEdge.findMany({
      where: { mutual: true, srcId: { in: [...memoryIds] }, dstId: { in: [...memoryIds] } },
      select: { srcId: true, dstId: true, weight: true },
    });
    const graph = emptyGraph(communities.length);
    for (const e of edges) {
      if (e.srcId >= e.dstId) continue; // each undirected pair once
      const ca = communityOfPersona.get(personaByEgoNeighbor.get(`${e.srcId} ${e.dstId}`) ?? '');
      const cb = communityOfPersona.get(personaByEgoNeighbor.get(`${e.dstId} ${e.srcId}`) ?? '');
      if (!ca || !cb || ca === cb) continue;
      addEdge(graph, nodeIndex.get(ca)!, nodeIndex.get(cb)!, e.weight);
    }
    return graph;
  }

  /** Walk the encoding tree top-down, creating a fresh internal Space for each
   *  internal node and re-parenting leaf-community Spaces under their tree parent. */
  private async materialize(
    userId: string,
    componentId: string,
    tree: EncodingTreeNode,
    communities: (EngineNode & { space: Space })[],
    generalId: string,
  ): Promise<void> {
    const assign = async (node: EncodingTreeNode, parentSpaceId: string): Promise<void> => {
      if (node.children.length === 0) {
        const community = communities[node.members[0]];
        if (community && community.space.parentId !== parentSpaceId) {
          await this.prisma.space.update({ where: { id: community.spaceId }, data: { parentId: parentSpaceId } });
        }
        return;
      }
      const parent = await this.prisma.space.findUniqueOrThrow({ where: { id: parentSpaceId } });
      const space = await this.areas.createChild(userId, parent, 'Grupo');
      await this.prisma.engineNode.create({ data: { userId, componentId, spaceId: space.id, kind: 'internal' } });
      for (const child of node.children) await assign(child, space.id);
    };

    // A single top-level internal node collapses to General; otherwise each top
    // grouping hangs directly under General.
    const roots = tree.children.length ? tree.children : [tree];
    for (const root of roots) await assign(root, generalId);
  }

  private async componentMemoryIds(communityNodeIds: string[]): Promise<string[]> {
    const personas = await this.prisma.memoryPersona.findMany({
      where: { communityId: { in: communityNodeIds } },
      select: { memoryId: true },
    });
    return [...new Set(personas.map((p) => p.memoryId))];
  }
}
