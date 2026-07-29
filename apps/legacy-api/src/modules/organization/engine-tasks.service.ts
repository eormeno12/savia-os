import { Injectable } from '@nestjs/common';
import type { EngineTask, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { MAX_ATTEMPTS, nextAttemptAt } from '../outbox/backoff';

/**
 * The engine's work queue (patrón outbox). It is NEVER scanned — the kernel
 * enqueues `memory_upserted`/`memory_removed` rows inside its own mutation
 * transaction (so the graph can never diverge from Postgres), and the community/
 * tree layers enqueue coalesced `rebuild_component` rows. The EngineWorker drains
 * it. Succeeded tasks are deleted (transient queue entries; the durable history is
 * the MemoryEvent/OutboxEvent trail), which also frees a coalescing `dedupeKey`.
 */
@Injectable()
export class EngineTasksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Distinct users with at least one due, pending task (the worker iterates these). */
  async pendingUserIds(limit = 50): Promise<string[]> {
    const rows = await this.prisma.engineTask.findMany({
      where: dueWhere(),
      distinct: ['userId'],
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => r.userId);
  }

  /** Claim one user's due tasks in FIFO order (single-flight worker → no row locks). */
  async claimForUser(userId: string, limit = 500): Promise<EngineTask[]> {
    return this.prisma.engineTask.findMany({
      where: { userId, ...dueWhere() },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /** Succeeded → drop the row (frees any dedupeKey for a future coalesced task). */
  async complete(id: string): Promise<void> {
    await this.prisma.engineTask.delete({ where: { id } }).catch(() => undefined);
  }

  /** Failed → backoff and retry, or land in `failed` after MAX_ATTEMPTS. */
  async fail(task: EngineTask, err: unknown): Promise<void> {
    const attempts = task.attempts + 1;
    const terminal = attempts >= MAX_ATTEMPTS;
    await this.prisma.engineTask.update({
      where: { id: task.id },
      data: {
        attempts,
        status: terminal ? 'failed' : 'pending',
        nextAttemptAt: terminal ? null : nextAttemptAt(attempts),
        lastError: String((err as Error)?.message ?? err).slice(0, 500),
      },
    });
  }

  /**
   * Enqueue a coalesced encoding-tree rebuild for a component. If a pending
   * rebuild for that component already exists, this is a no-op (dedupeKey) — N
   * changes to a component collapse into one rebuild.
   */
  async enqueueRebuild(userId: string, componentId: string): Promise<void> {
    const dedupeKey = `tree:${componentId}`;
    await this.prisma.engineTask.upsert({
      where: { dedupeKey },
      create: { userId, kind: 'rebuild_component', payload: { componentId }, dedupeKey },
      update: {}, // already queued → coalesce
    });
  }
}

/**
 * Enqueue a per-memory task INSIDE an existing mutation transaction. Pure helper
 * (takes the tx client) so the write-kernel can call it without a DI dependency on
 * the engine module — the same way it writes OutboxEvent/MemoryEvent rows inline.
 */
export async function enqueueMemoryTask(
  tx: Prisma.TransactionClient,
  userId: string,
  memoryId: string,
  kind: 'memory_upserted' | 'memory_removed',
): Promise<void> {
  await tx.engineTask.create({ data: { userId, kind, payload: { memoryId } } });
}

function dueWhere(): Prisma.EngineTaskWhereInput {
  return {
    status: 'pending',
    OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
  };
}
