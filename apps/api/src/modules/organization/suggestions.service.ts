import { Injectable } from '@nestjs/common';
import type { Prisma, SuggestionKind } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { NotFoundError } from '../../common/errors/domain-error';
import { MemoryMutationService } from '../kernel/memory-mutation.service';
import { AreasService } from '../areas/areas.service';

/** Discriminated shape of `Suggestion.payload` per kind — the DB column stays
 *  Json (Postgres has no better native option for a per-kind shape), but no
 *  code should ever read it as untyped `Record<string, unknown>` again. */
export interface SplitPayload {
  nodeId: string;
  children: string[]; // the two sub-areas the split created
  memoryEventIds: string[]; // one 'move' MemoryEvent per relocated memory — dismiss() reverts these
}
export interface MergePayload {
  survivor: string;
  gone: string; // deleted — NOT revertible (recreating it with its CF/centroid history isn't sound)
}
export interface DuplicatePayload {
  supersededIds: string[];
}

/**
 * The proposal queue surfaced in the Bandeja (05 §1). The engine auto-applies
 * access-preserving reorg silently, but records each change as a Suggestion so
 * the user can see it and undo it. `dismiss` is the ONE place that performs the
 * full undo per kind: `duplicate` restores the superseded memories; `split`
 * reverts every relocated memory (via its MemoryEvent) and drops any sub-area
 * left empty by that revert. `merge` has nothing to revert — it deleted an
 * area, and recreating it isn't sound — so dismiss just acknowledges it.
 */
@Injectable()
export class SuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kernel: MemoryMutationService,
    private readonly areas: AreasService,
  ) {}

  async create(userId: string, kind: SuggestionKind, payload: Prisma.InputJsonValue, rationale: string) {
    const suggestion = await this.prisma.suggestion.create({ data: { userId, kind, payload, rationale } });
    await this.prisma.notification.create({
      data: { userId, kind: 'suggestion', refId: suggestion.id, data: { kind, rationale } },
    });
    return suggestion;
  }

  list(userId: string, status?: 'pending' | 'accepted' | 'dismissed') {
    return this.prisma.suggestion.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async accept(userId: string, id: string): Promise<void> {
    const s = await this.prisma.suggestion.findFirst({ where: { id, userId } });
    if (!s) throw new NotFoundError('Sugerencia no encontrada');
    await this.prisma.suggestion.update({ where: { id }, data: { status: 'accepted' } });
  }

  async dismiss(userId: string, id: string): Promise<void> {
    const s = await this.prisma.suggestion.findFirst({ where: { id, userId } });
    if (!s) throw new NotFoundError('Sugerencia no encontrada');

    if (s.kind === 'duplicate') {
      const { supersededIds } = s.payload as unknown as DuplicatePayload;
      for (const memoryId of supersededIds ?? []) await this.kernel.restore(memoryId, userId).catch(() => null);
    } else if (s.kind === 'split') {
      const { children, memoryEventIds } = s.payload as unknown as SplitPayload;
      for (const eventId of memoryEventIds ?? []) await this.revertMoveEvent(userId, eventId);
      for (const spaceId of children ?? []) await this.removeIfEmpty(userId, spaceId);
    }
    // 'merge' has no undo path — the gone area is deleted, not revertible; dismiss just acknowledges it.

    await this.prisma.suggestion.update({ where: { id }, data: { status: 'dismissed' } });
  }

  /** Best-effort: reverts one 'move' MemoryEvent back to its previousMembership.
   *  Skips silently if already reverted, missing, or the memory diverged since
   *  (moved again independently) — a partial revert across a batch is still
   *  meaningful, this isn't an all-or-nothing operation. */
  private async revertMoveEvent(userId: string, eventId: string): Promise<void> {
    const event = await this.prisma.memoryEvent.findFirst({ where: { id: eventId, userId, action: 'move' } });
    if (!event || event.revertedAt || !event.memoryId) return;
    const payload = event.revertPayload as { previousMembership?: string[] } | null;
    if (!payload?.previousMembership?.length) return;
    await this.kernel.updateMembership(event.memoryId, userId, payload.previousMembership).catch(() => null);
    await this.prisma.memoryEvent.update({ where: { id: event.id }, data: { revertedAt: new Date() } });
  }

  /** After reverting a split's moves, a sub-area may be left with no members —
   *  drop it via the normal area-delete path (re-parents any stray children,
   *  re-homes any leftover File/MemoryArea before deleting — never a raw
   *  prisma.space.delete, which would cascade away children we want to keep). */
  private async removeIfEmpty(userId: string, spaceId: string): Promise<void> {
    const count = await this.prisma.memoryArea.count({ where: { spaceId } });
    if (count === 0) await this.areas.remove(userId, spaceId).catch(() => null);
  }
}
