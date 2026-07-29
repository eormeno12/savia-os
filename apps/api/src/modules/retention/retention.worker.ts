import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/clients/prisma.service';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Retention / housekeeping (F8 datos). Several tables grow unboundedly by design
 * (one AuthSession row per refresh, OTP codes, committed outbox events, audit
 * logs). This hourly cron prunes what is safe to drop. Worker process only.
 */
@Injectable()
export class RetentionWorker {
  private readonly logger = new Logger(RetentionWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purge(): Promise<void> {
    const now = Date.now();
    const olderThan = (days: number) => new Date(now - days * DAY);
    try {
      const [sessions, connections, otps, outbox, access, webhooks] = await Promise.all([
        // expired, or revoked more than 7d ago (keep recent revoked for the grace window + forensics)
        this.prisma.authSession.deleteMany({
          where: { OR: [{ expiresAt: { lt: new Date(now) } }, { revokedAt: { lt: olderThan(7) } }] },
        }),
        // mismo criterio que AuthSession: revocada >7d → cascada borra sus Grant.
        this.prisma.connection.deleteMany({ where: { revokedAt: { lt: olderThan(7) } } }),
        this.prisma.otpCode.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
        this.prisma.outboxEvent.deleteMany({ where: { status: 'committed', committedAt: { lt: olderThan(7) } } }),
        this.prisma.accessLog.deleteMany({ where: { createdAt: { lt: olderThan(90) } } }), // 90d audit window
        this.prisma.webhookEvent.deleteMany({ where: { processedAt: { lt: olderThan(30) } } }),
      ]);
      const resurrected = await this.resurrectFailedOutbox();
      this.logger.log(
        `retention: sessions=${sessions.count} connections=${connections.count} otps=${otps.count} outbox=${outbox.count} access=${access.count} webhooks=${webhooks.count} resurrected=${resurrected}`,
      );
    } catch (err) {
      this.logger.error(`retention purge failed: ${(err as Error).message}`);
    }
  }

  /** Outbox events never truly die: a `failed` row gets bounced back to
   *  `pending` every hour, unconditionally. If Qdrant (or whatever it depends
   *  on) is still down it just fails again and re-enters its own backoff
   *  ladder; if it recovered, the next relay/GC tick applies it. `lastError`
   *  is kept (not cleared) so an operator can see why it kept failing. */
  private async resurrectFailedOutbox(): Promise<number> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { status: 'failed' },
      data: { status: 'pending', attempts: 0, nextAttemptAt: null },
    });
    return result.count;
  }
}
