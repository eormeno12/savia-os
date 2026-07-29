import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/clients/prisma.service';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { EntityGraphPort } from '../../common/ports/entity-graph.port';
import { P } from '../../common/ports/predicate';
import { ENGINE } from './engine-config';

/**
 * Layer [1]: the mutual-kNN memory graph. Qdrant (HNSW) is the neighbour engine —
 * we never rebuild a proximity structure, we query the one it already maintains.
 * Each memory stores its top-K directed out-edges (its kNN); an edge is a real
 * graph edge only when it is MUTUAL (both endpoints keep each other), which prunes
 * weak asymmetric links and is the first of the stability guarantees.
 *
 * Edge weight = cosine (Qdrant score) + entity boost (shared entities via the mem0
 * entity store). Both are SYMMETRIC, so weight(u→v) === weight(v→u) — the property
 * the incremental eviction below relies on to decide reverse membership without a
 * second kNN query.
 */
@Injectable()
export class MemoryGraphService {
  private readonly logger = new Logger(MemoryGraphService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectors: VectorStorePort,
    private readonly entityGraph: EntityGraphPort,
  ) {}

  /**
   * Insert (or re-insert) a memory into the graph: recompute its out-edges from a
   * fresh kNN, then reconcile mutuality — for each neighbour, decide whether this
   * memory now belongs in the neighbour's top-K (weight symmetric), evicting the
   * neighbour's weakest edge if it is over capacity. Returns every memory whose
   * ego-net changed (itself + neighbours gained/evicted) so the persona layer can
   * recompute exactly those.
   */
  async insert(memoryId: string, userId: string, vec1536: number[]): Promise<Set<string>> {
    const affected = new Set<string>();
    const hits = await this.vectors.knn(vec1536, P.own(userId), ENGINE.K + 1);
    const neighbors = hits.filter((h) => h.id !== memoryId).slice(0, ENGINE.K);

    const myEnts = new Set(await this.safeEntities(userId, memoryId));

    await this.prisma.memoryEdge.deleteMany({ where: { srcId: memoryId } });

    for (const h of neighbors) {
      const cos = h.score ?? 0;
      const boost = myEnts.size && shareAny(myEnts, await this.safeEntities(userId, h.id)) ? ENGINE.ENTITY_BOOST : 0;
      const weight = cos + boost;
      await this.putEdge(memoryId, h.id, userId, cos, boost, weight);
      if (await this.considerReverse(h.id, memoryId, userId, cos, boost, weight, affected)) affected.add(h.id);
    }

    await this.syncMutual(memoryId);
    affected.add(memoryId);
    return affected;
  }

  /**
   * Remove a memory from the graph (archive/supersede — the point may still be in
   * Qdrant during the grace window, so we cannot rely on FK cascade). Deletes every
   * incident edge and returns the neighbours whose ego-net changed.
   */
  async remove(memoryId: string): Promise<Set<string>> {
    const inc = await this.prisma.memoryEdge.findMany({
      where: { OR: [{ srcId: memoryId }, { dstId: memoryId }] },
      select: { srcId: true, dstId: true },
    });
    const affected = new Set<string>();
    for (const e of inc) {
      affected.add(e.srcId);
      affected.add(e.dstId);
    }
    await this.prisma.memoryEdge.deleteMany({ where: { OR: [{ srcId: memoryId }, { dstId: memoryId }] } });
    affected.delete(memoryId);
    return affected;
  }

  /** The ego-net: mutual neighbours + the mutual edges AMONG them (ego excluded). */
  async egoNet(memoryId: string): Promise<{ neighbors: string[]; edgesAmong: [string, string][] }> {
    const mine = await this.prisma.memoryEdge.findMany({
      where: { srcId: memoryId, mutual: true },
      select: { dstId: true },
    });
    const neighbors = mine.map((e) => e.dstId);
    if (neighbors.length < 2) return { neighbors, edgesAmong: [] };

    const among = await this.prisma.memoryEdge.findMany({
      where: { mutual: true, srcId: { in: neighbors }, dstId: { in: neighbors } },
      select: { srcId: true, dstId: true },
    });
    const seen = new Set<string>();
    const edgesAmong: [string, string][] = [];
    for (const e of among) {
      if (e.srcId === e.dstId) continue;
      const key = e.srcId < e.dstId ? `${e.srcId} ${e.dstId}` : `${e.dstId} ${e.srcId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edgesAmong.push([e.srcId, e.dstId]);
    }
    return { neighbors, edgesAmong };
  }

  /** Mutual neighbours with weights — the online-placement signal. */
  async mutualNeighbors(memoryId: string): Promise<{ id: string; weight: number }[]> {
    const rows = await this.prisma.memoryEdge.findMany({
      where: { srcId: memoryId, mutual: true },
      select: { dstId: true, weight: true },
    });
    return rows.map((r) => ({ id: r.dstId, weight: r.weight }));
  }

  /**
   * Top-1 near-duplicate at add-time: the closest live memory whose cosine ≥
   * NEAR_DUP_COS. Reuses the SAME kNN that feeds the graph — one query does both
   * dedup and neighbour discovery.
   */
  async nearDupTop1(
    userId: string,
    vec1536: number[],
    excludeId?: string,
  ): Promise<{ memoryId: string; score: number } | null> {
    const hits = await this.vectors.knn(vec1536, P.own(userId), 2);
    for (const h of hits) {
      if (h.id === excludeId) continue;
      return (h.score ?? 0) >= ENGINE.NEAR_DUP_COS ? { memoryId: h.id, score: h.score ?? 0 } : null;
    }
    return null;
  }

  // ── internals ────────────────────────────────────────────────────────────────

  private async putEdge(
    src: string,
    dst: string,
    userId: string,
    cos: number,
    boost: number,
    weight: number,
  ): Promise<void> {
    await this.prisma.memoryEdge.upsert({
      where: { srcId_dstId: { srcId: src, dstId: dst } },
      create: { srcId: src, dstId: dst, userId, simScore: cos, entBoost: boost, weight, mutual: false },
      update: { simScore: cos, entBoost: boost, weight },
    });
  }

  /** Decide whether `m` enters `h`'s top-K out-edges (weight symmetric), evicting
   *  `h`'s weakest edge when over capacity. Returns whether `h` changed. */
  private async considerReverse(
    h: string,
    m: string,
    userId: string,
    cos: number,
    boost: number,
    weight: number,
    affected: Set<string>,
  ): Promise<boolean> {
    const hOut = await this.prisma.memoryEdge.findMany({ where: { srcId: h }, orderBy: { weight: 'asc' } });
    if (hOut.some((e) => e.dstId === m)) return false; // already linked
    const qualifies = hOut.length < ENGINE.K || weight > hOut[0].weight;
    if (!qualifies) return false;

    await this.putEdge(h, m, userId, cos, boost, weight);
    if (hOut.length + 1 > ENGINE.K) {
      const weakest = hOut[0]; // ascending → the minimum-weight out-edge
      await this.prisma.memoryEdge.delete({ where: { srcId_dstId: { srcId: h, dstId: weakest.dstId } } });
      await this.prisma.memoryEdge.updateMany({
        where: { srcId: weakest.dstId, dstId: h },
        data: { mutual: false },
      });
      affected.add(weakest.dstId);
    }
    return true;
  }

  /** Recompute `mutual` for every edge incident to `m` (both directions). */
  private async syncMutual(m: string): Promise<void> {
    const out = await this.prisma.memoryEdge.findMany({ where: { srcId: m }, select: { dstId: true } });
    for (const { dstId } of out) {
      const rev = await this.prisma.memoryEdge.findUnique({
        where: { srcId_dstId: { srcId: dstId, dstId: m } },
        select: { srcId: true },
      });
      await this.prisma.memoryEdge.update({
        where: { srcId_dstId: { srcId: m, dstId } },
        data: { mutual: !!rev },
      });
      if (rev) {
        await this.prisma.memoryEdge.update({
          where: { srcId_dstId: { srcId: dstId, dstId: m } },
          data: { mutual: true },
        });
      }
    }
  }

  private async safeEntities(userId: string, memoryId: string): Promise<string[]> {
    try {
      return await this.entityGraph.entitiesForMemory(userId, memoryId);
    } catch (err) {
      this.logger.debug(`entities unavailable for ${memoryId}: ${(err as Error).message}`);
      return [];
    }
  }
}

function shareAny(a: Set<string>, b: readonly string[]): boolean {
  for (const x of b) if (a.has(x)) return true;
  return false;
}
