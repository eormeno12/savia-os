import { Injectable, Logger } from '@nestjs/common';
import type { MemorySource, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { P } from '../../common/ports/predicate';
import { PAYLOAD_KEYS } from '../../common/adapters/qdrant.connection';
import { ForbiddenError, NotFoundError } from '../../common/errors/domain-error';
import { KernelOp, WriteKernelPolicy } from './write-kernel.policy';
import { facetsOf } from '../../common/adapters/facets';
import { enqueueMemoryTask } from '../organization/engine-tasks.service';

const PURGE_GRACE_MS = 24 * 60 * 60 * 1000; // 24h reversible window before hard purge

export interface AssignInput {
  memoryId: string;
  authorUserId: string;
  membership: string[]; // areas + ancestors (closure) → MemoryArea rows + payload
  sensitivity: 'normal' | 'sensitive';
  entities?: string[];
  fileId?: string | null;
  source?: MemorySource;
  sourceRef?: string | null; // connectionId (mcp) | jobId (import)
  sourceLabel?: string | null; // snapshot legible para el Pulso
}

/**
 * The single I/O gateway for memory mutations (08 §6.3 / 0A F1). EVERY memory
 * write goes through here — it consults the pure {@link WriteKernelPolicy}, then
 * commits one Postgres `$transaction` over (MemoryIndex + OutboxEvent +
 * MemoryEvent + CF). Qdrant is touched ONLY later by the OutboxRelay, so a
 * Qdrant outage can never leave Postgres and the vector store inconsistent.
 */
@Injectable()
export class MemoryMutationService {
  private readonly logger = new Logger(MemoryMutationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: WriteKernelPolicy,
    private readonly vectors: VectorStorePort,
  ) {}

  /** Create + route a memory (the post-mem0.add hook). */
  async assign(input: AssignInput): Promise<void> {
    const areaOwners = await this.ownersOf(input.membership);
    this.enforce({
      kind: 'assign',
      memoryId: input.memoryId,
      authorUserId: input.authorUserId,
      membership: input.membership,
      areaOwners,
    });

    const payload = {
      [PAYLOAD_KEYS.areaIds]: input.membership,
      [PAYLOAD_KEYS.sensitivity]: input.sensitivity,
      [PAYLOAD_KEYS.superseded]: false,
      [PAYLOAD_KEYS.userId]: input.authorUserId,
      ...(input.entities?.length ? { [PAYLOAD_KEYS.entities]: input.entities } : {}),
    } satisfies Prisma.InputJsonObject;

    await this.prisma.$transaction(async (tx) => {
      await tx.memoryIndex.create({
        data: {
          memoryId: input.memoryId,
          authorUserId: input.authorUserId,
          sensitivity: input.sensitivity,
          fileId: input.fileId ?? null,
          source: input.source ?? 'manual',
          sourceRef: input.sourceRef ?? null,
          sourceLabel: input.sourceLabel ?? null,
        },
      });
      // Membership = verdad en MemoryArea (proyectada al payload por el outbox).
      await tx.memoryArea.createMany({
        data: input.membership.map((spaceId) => ({ memoryId: input.memoryId, spaceId })),
        skipDuplicates: true,
      });
      await tx.outboxEvent.create({
        data: { kind: 'set_payload', memoryId: input.memoryId, payload },
      });
      await tx.memoryEvent.create({
        data: {
          userId: input.authorUserId,
          action: 'create',
          memoryId: input.memoryId,
          spaceId: input.membership[0], // referencia de área para el feed del Pulso (ya no hay primaria)
          revertPayload: { op: 'purge', memoryId: input.memoryId },
        },
      });
      // Engine v2: the memory entered the graph. Enqueue INSIDE the tx so the
      // persona graph can never diverge from Postgres (same posture as the outbox).
      await enqueueMemoryTask(tx, input.authorUserId, input.memoryId, 'memory_upserted');
    });
  }

  /** User-initiated delete: hide now (reversible during grace), purge later via GC. */
  async archive(memoryId: string, authorUserId: string): Promise<void> {
    const memory = await this.prisma.memoryIndex.findUnique({ where: { memoryId } });
    if (!memory) throw new NotFoundError('Memoria no encontrada');

    await this.prisma.$transaction(async (tx) => {
      await tx.memoryIndex.update({ where: { memoryId }, data: { supersededBy: memoryId } });
      await tx.outboxEvent.create({
        data: { kind: 'set_payload', memoryId, payload: { [PAYLOAD_KEYS.superseded]: true } },
      });
      await tx.outboxEvent.create({
        data: {
          kind: 'purge',
          memoryId,
          payload: { graceUntil: Date.now() + PURGE_GRACE_MS, reason: 'user_delete' },
        },
      });
      await tx.memoryEvent.create({
        data: {
          userId: authorUserId,
          action: 'supersede',
          memoryId,
          revertPayload: { op: 'restore', memoryId },
        },
      });
      await enqueueMemoryTask(tx, authorUserId, memoryId, 'memory_removed'); // left the graph
    });
  }

  async setSensitivity(
    memoryId: string,
    authorUserId: string,
    sensitivity: 'normal' | 'sensitive',
  ): Promise<void> {
    this.enforce({ kind: 'sensitivity', memoryId, authorUserId, sensitivity });
    await this.prisma.$transaction(async (tx) => {
      // Capture the prior value INSIDE the tx — revert needs it to invert "set to X".
      const before = await tx.memoryIndex.findUniqueOrThrow({
        where: { memoryId },
        select: { sensitivity: true },
      });
      await tx.memoryIndex.update({ where: { memoryId }, data: { sensitivity } });
      await tx.outboxEvent.create({
        data: {
          kind: 'set_payload',
          memoryId,
          payload: { [PAYLOAD_KEYS.sensitivity]: sensitivity },
        },
      });
      await tx.memoryEvent.create({
        data: {
          userId: authorUserId,
          action: 'sensitivity',
          memoryId,
          revertPayload: { op: 'sensitivity', memoryId, previousSensitivity: before.sensitivity },
        },
      });
    });
  }

  /** Consolidation (08 §4.6): hide a near-duplicate, reversibly. Never deletes. */
  async supersede(memoryId: string, supersededBy: string, authorUserId: string): Promise<void> {
    this.enforce({ kind: 'supersede', memoryId, authorUserId, supersededBy });
    await this.prisma.$transaction(async (tx) => {
      await tx.memoryIndex.update({ where: { memoryId }, data: { supersededBy } });
      await tx.outboxEvent.create({
        data: { kind: 'set_payload', memoryId, payload: { [PAYLOAD_KEYS.superseded]: true } },
      });
      await tx.memoryEvent.create({
        data: {
          userId: authorUserId,
          action: 'supersede',
          memoryId,
          revertPayload: { op: 'restore', memoryId },
        },
      });
      await enqueueMemoryTask(tx, authorUserId, memoryId, 'memory_removed'); // dup hidden → out of graph
    });
  }

  /** Undo a supersede/archive (within grace) — the reversibility guarantee. */
  async restore(memoryId: string, authorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.memoryIndex.update({ where: { memoryId }, data: { supersededBy: null } });
      await tx.outboxEvent.create({
        data: { kind: 'set_payload', memoryId, payload: { [PAYLOAD_KEYS.superseded]: false } },
      });
      // Cancel any scheduled hard-purge — restoring must not let the GC delete it later.
      await tx.outboxEvent.deleteMany({ where: { memoryId, kind: 'purge', status: 'pending' } });
      await tx.memoryEvent.create({
        data: {
          userId: authorUserId,
          action: 'supersede',
          memoryId,
          revertedAt: new Date(),
          revertPayload: { op: 'restored' },
        },
      });
      await enqueueMemoryTask(tx, authorUserId, memoryId, 'memory_upserted'); // back in the graph
    });
  }

  /** Re-route a memory to a new membership (engine reorg / user membership edit).
   *  Returns the MemoryEvent id — callers that batch several moves (e.g. a split)
   *  collect these to make the whole batch revertible as one unit later. */
  async updateMembership(
    memoryId: string,
    authorUserId: string,
    membership: string[],
  ): Promise<string> {
    const areaOwners = await this.ownersOf(membership);
    this.enforce({ kind: 'move', memoryId, authorUserId, membership, areaOwners });
    return await this.prisma.$transaction(async (tx) => {
      // Capture the prior membership INSIDE the tx — revert needs it to move back.
      const before = await tx.memoryArea.findMany({
        where: { memoryId },
        select: { spaceId: true },
      });
      const previousMembership = before.map((b) => b.spaceId);
      // MemoryArea es la verdad: reescribir el conjunto completo (membership = closure).
      await tx.memoryArea.deleteMany({ where: { memoryId } });
      await tx.memoryArea.createMany({
        data: membership.map((spaceId) => ({ memoryId, spaceId })),
        skipDuplicates: true,
      });
      await tx.outboxEvent.create({
        data: { kind: 'set_payload', memoryId, payload: { [PAYLOAD_KEYS.areaIds]: membership } },
      });
      const event = await tx.memoryEvent.create({
        data: {
          userId: authorUserId,
          action: 'move',
          memoryId,
          spaceId: membership[0],
          revertPayload: { op: 'move', memoryId, previousMembership },
        },
      });
      return event.id;
    });
  }

  /**
   * Seed a freshly created personalized area with EXISTING memories the user
   * picked (search+confirm — areas.service.ts `create()` with `memoryIds`).
   * Additive: never removes a memory's prior membership elsewhere. Fails
   * all-or-nothing if any memoryId doesn't belong to `authorUserId` — never
   * filters silently (same fail-loud posture as the rest of the kernel).
   */
  async seedMembership(spaceId: string, authorUserId: string, memoryIds: string[]): Promise<void> {
    if (memoryIds.length === 0) return;

    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { ownerUserId: true },
    });
    if (!space) throw new NotFoundError('Área no encontrada');

    const owned = await this.prisma.memoryIndex.findMany({
      where: { memoryId: { in: memoryIds }, authorUserId },
      select: { memoryId: true },
    });

    this.enforce({ kind: 'seed', spaceId, authorUserId, spaceOwnerUserId: space.ownerUserId, memoryIds });
    if (owned.length !== memoryIds.length) {
      throw new ForbiddenError(
        'write-kernel denied: one or more memories cross ownership scope',
        'KernelDenied',
      );
    }

    // Fetch current membership for every member in ONE round-trip, BEFORE opening
    // the transaction — a Qdrant hiccup must never abort an otherwise-valid Postgres
    // batch, and a tx must never sit open across N sequential network calls.
    const currentAreasByMemoryId = await this.currentAreasFor(authorUserId, memoryIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.memoryArea.createMany({
        data: memoryIds.map((memoryId) => ({ memoryId, spaceId })),
        skipDuplicates: true,
      });
      for (const memoryId of memoryIds) {
        const current = currentAreasByMemoryId.get(memoryId) ?? [];
        await tx.outboxEvent.create({
          data: {
            kind: 'set_payload',
            memoryId,
            payload: { [PAYLOAD_KEYS.areaIds]: [...new Set([...current, spaceId])] },
          },
        });
      }
    });
  }

  /** Current `savia_area_ids` for a batch of memories, in one round-trip.
   *  Best-effort: a Qdrant hiccup yields an empty map (the outbox `set_payload`
   *  just carries fewer prior areas) rather than aborting the whole seed. */
  private async currentAreasFor(authorUserId: string, memoryIds: string[]): Promise<Map<string, string[]>> {
    try {
      const points = await this.vectors.retrieve(memoryIds, P.author(authorUserId));
      return new Map(points.map((p) => [p.id, facetsOf(p.payload).areaIds ?? []]));
    } catch {
      return new Map();
    }
  }

  private enforce(op: KernelOp): void {
    const decision = this.policy.decide(op);
    if (!decision.allowed)
      throw new ForbiddenError(`write-kernel denied: ${decision.reason}`, 'KernelDenied');
  }

  private async ownersOf(areaIds: string[]): Promise<Record<string, string>> {
    const spaces = await this.prisma.space.findMany({
      where: { id: { in: areaIds } },
      select: { id: true, ownerUserId: true },
    });
    return Object.fromEntries(spaces.map((s) => [s.id, s.ownerUserId]));
  }
}
