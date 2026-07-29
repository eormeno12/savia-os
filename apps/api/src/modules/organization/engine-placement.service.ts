import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/clients/prisma.service';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { AreasService } from '../areas/areas.service';
import { MemoryGraphService } from './memory-graph.service';
import { P } from '../../common/ports/predicate';
import { ENGINE } from './engine-config';

export interface Placement {
  /** Set when the new memory is a near-duplicate of an existing one (top-1 ≥ NEAR_DUP_COS). */
  duplicateOf?: string;
  /** Provisional membership (closure) to assign now; the worker refines it in seconds. */
  membership: string[];
}

/**
 * The synchronous, at-add-time half of the engine (called from memory.service.add).
 * One kNN does three jobs: near-duplicate detection, and a provisional placement =
 * the plurality community among the new memory's nearest neighbours (so it shows up
 * in a sensible area instantly), which the async `memory_upserted` refinement then
 * corrects via the full persona/community pass. An explicit target area (file
 * ingest, user pick) short-circuits to that area's closure.
 */
@Injectable()
export class EnginePlacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectors: VectorStorePort,
    private readonly areas: AreasService,
    private readonly graph: MemoryGraphService,
  ) {}

  async placeAtAdd(
    userId: string,
    memoryId: string,
    vec1536: number[],
    explicitAreaId?: string,
  ): Promise<Placement> {
    const hits = await this.vectors.knn(vec1536, P.own(userId), ENGINE.K + 1);
    const neighbors = hits.filter((h) => h.id !== memoryId);

    const top = neighbors[0];
    if (top && (top.score ?? 0) >= ENGINE.NEAR_DUP_COS) {
      return { duplicateOf: top.id, membership: [] };
    }

    if (explicitAreaId) {
      return { membership: await this.areas.closure([explicitAreaId]) };
    }

    const leaf = await this.pluralityCommunitySpace(neighbors.slice(0, ENGINE.K).map((h) => h.id));
    if (leaf) return { membership: await this.areas.closure([leaf]) };
    const general = await this.areas.ensureGeneral(userId);
    return { membership: [general.id] };
  }

  /** The leaf Space of the community holding the plurality of the given neighbours. */
  private async pluralityCommunitySpace(neighborIds: string[]): Promise<string | null> {
    if (neighborIds.length === 0) return null;
    const personas = await this.prisma.memoryPersona.findMany({
      where: { memoryId: { in: neighborIds }, communityId: { not: null } },
      select: { community: { select: { spaceId: true } } },
    });
    const count = new Map<string, number>();
    for (const p of personas) {
      const s = p.community?.spaceId;
      if (s) count.set(s, (count.get(s) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [space, n] of [...count].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (n > bestN) {
        bestN = n;
        best = space;
      }
    }
    return best;
  }
}
