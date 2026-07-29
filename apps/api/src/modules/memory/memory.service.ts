import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/clients/prisma.service';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { AccessPredicate, isDenyAll, P } from '../../common/ports/predicate';
import { MemoryMutationService } from '../kernel/memory-mutation.service';
import { AccessService } from '../access/access.service';
import { AreasService } from '../areas/areas.service';
import { EntityGraphPort } from '../../common/ports/entity-graph.port';
import { EnginePlacementService } from '../organization/engine-placement.service';
import { Mem0Service } from './mem0.service';
import { facetsOf } from '../../common/adapters/facets';
import type { MemorySource } from '@prisma/client';
import type { MemoryResult, UpdateMemoryDto } from '@savia-os/contracts';

const OVERFETCH = 5; // pull more candidates than `limit` since access filtering prunes

export interface AddOptions {
  source?: MemorySource;
  areaId?: string; // explicit target; otherwise General (FASE-3 adds real routing)
  entities?: string[];
  fileId?: string | null; // Drive: la memoria deriva de este archivo (FK tipada)
  sourceRef?: string | null; // connectionId (mcp) | jobId (import)
  sourceLabel?: string | null; // snapshot legible para el Pulso
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mem0: Mem0Service,
    private readonly kernel: MemoryMutationService,
    private readonly areas: AreasService,
    private readonly placement: EnginePlacementService,
    private readonly entityGraph: EntityGraphPort,
    private readonly access: AccessService,
    private readonly vectors: VectorStorePort,
  ) {}

  /**
   * The single write path for new memories: mem0 extracts facts, then EACH fact is
   * PLACED (near-dup check + provisional community) and committed through the
   * write-kernel, which enqueues the engine refinement. If the kernel rejects/fails
   * after mem0 stored the point, we compensate by deleting that orphan point — so
   * there is never a vector without a MemoryIndex. A near-duplicate is assigned then
   * immediately superseded (reversibly), so it never enters the graph.
   */
  async add(userId: string, text: string, opts: AddOptions = {}): Promise<string[]> {
    await this.areas.ensureGeneral(userId);
    if (opts.areaId) await this.access.assertCanManageSpace(userId, opts.areaId);

    const facts = await this.mem0.add(userId, text, { source: opts.source ?? 'manual' });
    const ids: string[] = [];

    for (const fact of facts) {
      try {
        const [point] = await this.vectors.retrieve([fact.id], P.author(userId), { withVectors: true }); // full 1536d
        const vec1536 = point?.vector ?? [];
        const entities = opts.entities?.length ? opts.entities : await this.entitiesFor(userId, fact.id);

        const placement = await this.placement.placeAtAdd(userId, fact.id, vec1536, opts.areaId);
        const membership = placement.duplicateOf ? [(await this.areas.ensureGeneral(userId)).id] : placement.membership;

        await this.kernel.assign({
          memoryId: fact.id,
          authorUserId: userId,
          membership,
          sensitivity: 'normal',
          entities,
          source: opts.source ?? 'manual',
          fileId: opts.fileId ?? null,
          sourceRef: opts.sourceRef ?? null,
          sourceLabel: opts.sourceLabel ?? null,
        });
        // Near-duplicate: hide it reversibly right away (its supersede MemoryEvent
        // gives the user undo via the Pulso). It never enters the mutual-kNN graph.
        if (placement.duplicateOf) await this.kernel.supersede(fact.id, placement.duplicateOf, userId);
        ids.push(fact.id);
      } catch (err) {
        const compensated = await this.vectors
          .deletePoints([fact.id], P.author(userId))
          .then(() => true)
          .catch(() => false);
        if (compensated) {
          this.logger.error(`assign failed for ${fact.id} (compensated): ${(err as Error).message}`);
        } else {
          // Compensation itself failed: an orphan point (no MemoryIndex row) is now
          // stuck in Qdrant — undeletable via deleteOwn() and still visible to
          // searchPersonal() (same user_id, no MemoryIndex check). Needs an operator
          // to intervene; flagged distinctly from the normal-path log above so it's
          // greppable/alertable instead of looking like a routine, resolved failure.
          this.logger.error(
            `assign failed for ${fact.id} AND compensation failed — orphan point left in Qdrant: ${(err as Error).message}`,
          );
        }
      }
    }
    return ids;
  }

  /** Best-effort entities for the `savia_entities` payload (naming reads it). */
  private async entitiesFor(userId: string, memoryId: string): Promise<string[]> {
    try {
      return await this.entityGraph.entitiesForMemory(userId, memoryId);
    } catch {
      return [];
    }
  }

  /** A user's search over their own memory (sees everything, incl. sensitive). */
  searchPersonal(userId: string, query: string, areaIds: string[] | undefined, limit: number): Promise<MemoryResult[]> {
    return this.search(userId, query, P.own(userId, { areaIds }), limit);
  }

  /**
   * Hybrid search (08 §6.1): mem0 returns dense+BM25+entity candidates over the
   * owner's partition; we post-filter with the access predicate (reusing the same
   * pure evaluator the unit tests use). Fails clean if the embedder is down (D8).
   */
  async search(
    ownerUserId: string,
    query: string,
    predicate: AccessPredicate,
    limit: number,
  ): Promise<MemoryResult[]> {
    if (isDenyAll(predicate)) return [];

    const candidates = await this.mem0.searchCandidates(ownerUserId, query, limit * OVERFETCH);
    if (candidates.length === 0) return [];

    const points = await this.vectors.retrieve(candidates.map((c) => c.id), predicate);
    const pointById = new Map(points.map((p) => [p.id, p]));

    const results: MemoryResult[] = [];
    for (const c of candidates) {
      const point = pointById.get(c.id);
      if (!point) continue; // excluded by the adapter's own predicate check
      const facets = facetsOf(point.payload);
      results.push({
        id: c.id,
        text: c.text,
        score: c.score,
        areaIds: facets.areaIds ?? [],
        sensitivity: facets.sensitivity ?? 'normal',
      });
      if (results.length >= limit) break;
    }
    return results;
  }

  /** DELETE /memory/:id — author-only (closes IDOR P0-1), reversible during grace. */
  async deleteOwn(userId: string, memoryId: string): Promise<void> {
    await this.access.assertCanMutateMemory(userId, memoryId);
    await this.kernel.archive(memoryId, userId);
  }

  /** Remove all memories derived from a file (on file deletion). */
  async deleteByFile(userId: string, fileId: string): Promise<void> {
    const rows = await this.prisma.memoryIndex.findMany({
      where: { fileId, authorUserId: userId },
      select: { memoryId: true },
    });
    for (const r of rows) await this.kernel.archive(r.memoryId, userId).catch(() => null);
  }

  /** PATCH /memory/:id — sensitivity + membership editing (author-only). */
  async update(userId: string, memoryId: string, dto: UpdateMemoryDto): Promise<void> {
    await this.access.assertCanMutateMemory(userId, memoryId);

    if (dto.sensitivity) {
      await this.kernel.setSensitivity(memoryId, userId, dto.sensitivity);
    }

    if (dto.addAreas?.length || dto.removeAreas?.length) {
      const [point] = await this.vectors.retrieve([memoryId], P.author(userId));
      const current = facetsOf(point?.payload ?? {}).areaIds ?? [];
      const add = dto.addAreas ?? [];
      for (const a of add) await this.access.assertCanManageSpace(userId, a);
      const remove = new Set(dto.removeAreas ?? []);
      const leaves = [...new Set([...current, ...add])].filter((a) => !remove.has(a));
      const membership = await this.areas.closure(leaves.length ? leaves : [(await this.areas.ensureGeneral(userId)).id]);
      await this.kernel.updateMembership(memoryId, userId, membership);
    }
  }
}
