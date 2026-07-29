import { Controller, Get, Header } from '@nestjs/common';
import { PrismaService } from '../clients/prisma.service';
import { Public } from '../../modules/auth/decorators/public.decorator';

/**
 * Prometheus metrics (F8.3). Exposes the operational signals that matter for the
 * gate: outbox lag (pending/failed → the Postgres↔Qdrant reconciliation health),
 * plus coarse counts. Scraped by Prometheus; alert on outbox_pending growth.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async metrics(): Promise<string> {
    const outbox = await this.prisma.outboxEvent.groupBy({ by: ['status'], _count: { _all: true } });
    const byStatus = Object.fromEntries(outbox.map((r) => [r.status, r._count._all]));
    const [memories, areas, users] = await Promise.all([
      this.prisma.memoryIndex.count(),
      this.prisma.space.count(),
      this.prisma.user.count(),
    ]);

    return [
      '# HELP savia_outbox_events Outbox events by status',
      '# TYPE savia_outbox_events gauge',
      `savia_outbox_events{status="pending"} ${byStatus.pending ?? 0}`,
      `savia_outbox_events{status="failed"} ${byStatus.failed ?? 0}`,
      `savia_outbox_events{status="committed"} ${byStatus.committed ?? 0}`,
      '# HELP savia_memories_total Total memory index rows',
      '# TYPE savia_memories_total gauge',
      `savia_memories_total ${memories}`,
      '# HELP savia_areas_total Total areas',
      '# TYPE savia_areas_total gauge',
      `savia_areas_total ${areas}`,
      '# HELP savia_users_total Total users',
      '# TYPE savia_users_total gauge',
      `savia_users_total ${users}`,
      '',
    ].join('\n');
  }
}
