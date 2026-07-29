import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../common/clients/prisma.service';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { P } from '../../common/ports/predicate';
import { MAX_ATTEMPTS, nextAttemptAt } from './backoff';

const BATCH = 100;

/**
 * The ONLY component that deletes vectors (08 §7 / 0A F5). It processes `purge`
 * outbox events, but ONLY after their grace window elapses — so a user delete is
 * reversible until then. Every purge is logged (audit). Splitting this out of the
 * relay keeps the "the engine never deletes" invariant intact: deletion is always
 * an explicit, audited, grace-gated act.
 */
@Injectable()
export class VectorGarbageCollector {
  private readonly logger = new Logger(VectorGarbageCollector.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectors: VectorStorePort,
  ) {}

  @Interval('vector-gc', 30_000)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.processPurges();
    } catch (err) {
      this.logger.error(`gc tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Public for tests. Returns how many memories were purged this pass. */
  async processPurges(): Promise<number> {
    const now = Date.now();
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'pending',
        kind: 'purge',
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });

    let purged = 0;
    for (const e of events) {
      const graceUntil = Number((e.payload as { graceUntil?: number })?.graceUntil ?? 0);
      if (graceUntil > now) continue; // still reversible

      try {
        if (e.memoryId) {
          // Internally-produced purge event: the write-kernel already validated
          // ownership of `memoryId` — no further narrowing needed.
          await this.vectors.deletePoints([e.memoryId], P.and(), { wait: true });
        }
        const reason = (e.payload as { reason?: string })?.reason ?? 'purge';
        // One atomic unit: the audit row is a promised guarantee (the class's own
        // docstring — "Every purge is logged"), not best-effort. If it fails, the
        // whole purge attempt retries via the same backoff/DLQ as everything else,
        // instead of silently completing with a missing AccessLog row.
        await this.prisma.$transaction([
          ...(e.memoryId ? [this.prisma.memoryIndex.deleteMany({ where: { memoryId: e.memoryId } })] : []),
          this.prisma.accessLog.create({
            data: { connectionId: 'system', action: `purge:${reason}`, spaceIds: [], resultCount: 1 },
          }),
          this.prisma.outboxEvent.update({
            where: { id: e.id },
            data: { status: 'committed', committedAt: new Date() },
          }),
        ]);
        this.logger.log(`purged memory=${e.memoryId} reason=${reason}`);
        purged++;
      } catch (err) {
        const attempts = e.attempts + 1;
        const terminal = attempts >= MAX_ATTEMPTS;
        await this.prisma.outboxEvent.update({
          where: { id: e.id },
          data: {
            attempts,
            status: terminal ? 'failed' : 'pending',
            nextAttemptAt: terminal ? null : nextAttemptAt(attempts),
            lastError: (err as Error).message.slice(0, 500),
          },
        });
        this.logger.warn(`purge ${e.id} failed: ${(err as Error).message}`);
      }
    }
    return purged;
  }
}
