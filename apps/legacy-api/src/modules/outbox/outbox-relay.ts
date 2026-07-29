import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../common/clients/prisma.service';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { P } from '../../common/ports/predicate';
import { MAX_ATTEMPTS, nextAttemptAt } from './backoff';

const BATCH = 100;

/**
 * The ONLY Postgres→Qdrant path (08 §7 / 0A F5). It drains pending `set_payload`
 * outbox events and applies them to Qdrant with `wait:true`, then marks them
 * committed. Idempotent: setPayload by point id is safe to replay, so a crash
 * mid-batch just re-applies. It NEVER deletes — that's the VectorGarbageCollector.
 */
@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectors: VectorStorePort,
  ) {}

  @Interval('outbox-relay', 1000)
  async tick(): Promise<void> {
    if (this.running) return; // no overlap
    this.running = true;
    try {
      await this.processBatch();
    } catch (err) {
      this.logger.error(`relay tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** Public for tests / immediate flush. Returns how many events committed. */
  async processBatch(): Promise<number> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'pending',
        kind: { in: ['set_payload', 'delete_payload'] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });

    let committed = 0;
    for (const e of events) {
      try {
        if (!e.memoryId) throw new Error('outbox event without memoryId');
        if (e.kind === 'set_payload') {
          // Internally-produced event: the write-kernel already validated ownership
          // of `memoryId` when it created this row — no further narrowing needed.
          await this.vectors.setPayload([e.memoryId], P.and(), e.payload as Record<string, unknown>, { wait: true });
        } else if (e.kind === 'delete_payload') {
          // un-routing (FASE-4) isn't built yet — fail loud + retry instead of
          // silently marking committed with no actual effect.
          throw new Error('delete_payload aún no implementado (FASE-4)');
        }
        await this.prisma.outboxEvent.update({
          where: { id: e.id },
          data: { status: 'committed', committedAt: new Date() },
        });
        committed++;
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
        this.logger.warn(`outbox ${e.id} attempt ${attempts} failed: ${(err as Error).message}`);
      }
    }
    return committed;
  }
}
