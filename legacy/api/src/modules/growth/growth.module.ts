import { Controller, Get, HttpCode, HttpStatus, Injectable, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/domain-error';
import { PrismaService } from '../../common/clients/prisma.service';
import { MemoryMutationService } from '../kernel/memory-mutation.service';
import { KernelModule } from '../kernel/kernel.module';
import { BillingModule } from '../billing/billing.module';
import { RequirePlan, RequirePlanGuard } from '../billing/require-plan.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import type { GrowthAreaDto, GrowthEventsPage, GrowthSummary } from '@savia-os/legacy-contracts';

const REVERTABLE_OPS = new Set(['restore', 'purge', 'sensitivity', 'move']);

/** Pulso: area overview, growth-over-time, and the event feed with revert. */
@Injectable()
export class GrowthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kernel: MemoryMutationService,
  ) {}

  async areas(userId: string): Promise<GrowthAreaDto[]> {
    const [spaces, counts] = await Promise.all([
      this.prisma.space.findMany({ where: { ownerUserId: userId }, select: { id: true, name: true, isDefault: true } }),
      this.prisma.memoryArea.groupBy({
        by: ['spaceId'],
        where: { space: { ownerUserId: userId }, memory: { supersededBy: null } },
        _count: { memoryId: true },
      }),
    ]);
    const countBySpace = new Map(counts.map((c) => [c.spaceId, c._count.memoryId]));
    const countOf = (id: string): number => countBySpace.get(id) ?? 0;
    const total = countOf(spaces.find((s) => s.isDefault)?.id ?? '') || Math.max(1, ...spaces.map((s) => countOf(s.id)));
    return spaces
      .filter((s) => !s.isDefault)
      .map((s) => ({ spaceId: s.id, name: s.name, count: countOf(s.id), share: countOf(s.id) / total }));
  }

  async summary(userId: string, days = 30): Promise<GrowthSummary> {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.memoryIndex.findMany({
      where: { authorUserId: userId, supersededBy: null, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const points = [...byDay.entries()].sort().map(([bucket, count]) => ({ bucket, count }));
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date(Date.now() - 7 * 86_400_000);
    const prevWeekStart = new Date(Date.now() - 14 * 86_400_000);
    const weekTotal = rows.filter((r) => r.createdAt >= weekStart).length;
    const prevWeek = rows.filter((r) => r.createdAt >= prevWeekStart && r.createdAt < weekStart).length;
    return {
      points,
      todayTotal: byDay.get(today) ?? 0,
      weekTotal,
      weekDelta: weekTotal - prevWeek,
    };
  }

  async events(userId: string, cursor?: string): Promise<GrowthEventsPage> {
    const take = 30;
    const events = await this.prisma.memoryEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = events.slice(0, take);
    return {
      items: page.map((e) => ({
        id: e.id,
        action: e.action,
        spaceId: e.spaceId,
        memoryId: e.memoryId,
        reverted: e.revertedAt !== null,
        revertable: e.revertedAt === null && REVERTABLE_OPS.has((e.revertPayload as { op?: string })?.op ?? ''),
        createdAt: e.createdAt.toISOString(),
      })),
      nextCursor: events.length > take ? page[page.length - 1].id : null,
    };
  }

  async revert(userId: string, eventId: string): Promise<void> {
    const event = await this.prisma.memoryEvent.findFirst({ where: { id: eventId, userId } });
    if (!event) throw new NotFoundError('Evento no encontrado');
    if (event.revertedAt) throw new ConflictError('Ya revertido');
    const payload = (event.revertPayload ?? {}) as {
      op?: string;
      memoryId?: string;
      previousSensitivity?: 'normal' | 'sensitive';
      previousMembership?: string[];
    };
    if (payload.op === 'restore' && payload.memoryId) {
      await this.kernel.restore(payload.memoryId, userId);
    } else if (payload.op === 'purge' && payload.memoryId) {
      await this.kernel.archive(payload.memoryId, userId);
    } else if (payload.op === 'sensitivity' && payload.memoryId && payload.previousSensitivity) {
      await this.kernel.setSensitivity(payload.memoryId, userId, payload.previousSensitivity);
    } else if (payload.op === 'move' && payload.memoryId && payload.previousMembership?.length) {
      await this.kernel.updateMembership(payload.memoryId, userId, payload.previousMembership);
    } else {
      throw new ValidationError('Este evento no es revertible');
    }
    await this.prisma.memoryEvent.update({ where: { id: eventId }, data: { revertedAt: new Date() } });
  }

  async accessActivity(userId: string) {
    const connections = await this.prisma.connection.findMany({ where: { userId }, select: { id: true, label: true } });
    const ids = connections.map((c) => c.id);
    const labels = new Map(connections.map((c) => [c.id, c.label]));
    const logs = await this.prisma.accessLog.findMany({
      where: { connectionId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return logs.map((l) => ({
      connection: labels.get(l.connectionId) ?? l.connectionId,
      action: l.action,
      resultCount: l.resultCount,
      createdAt: l.createdAt.toISOString(),
    }));
  }
}

@Controller('growth')
class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  @Get('areas')
  areas(@CurrentUser() user: JwtPayload) {
    return this.growth.areas(user.sub);
  }

  @Get()
  summary(@CurrentUser() user: JwtPayload, @Query('range') range?: string) {
    return this.growth.summary(user.sub, range === '7d' ? 7 : range === '90d' ? 90 : 30);
  }

  @Get('events')
  events(@CurrentUser() user: JwtPayload, @Query('cursor') cursor?: string) {
    return this.growth.events(user.sub, cursor);
  }

  @Post('events/:id/revert')
  @HttpCode(HttpStatus.NO_CONTENT)
  revert(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.growth.revert(user.sub, id);
  }

  // Live activity (which AIs read what) is a Pro capability.
  @Get('access-activity')
  @UseGuards(RequirePlanGuard)
  @RequirePlan('pro')
  accessActivity(@CurrentUser() user: JwtPayload) {
    return this.growth.accessActivity(user.sub);
  }
}

@Module({
  imports: [KernelModule, BillingModule],
  controllers: [GrowthController],
  providers: [GrowthService],
  exports: [GrowthService],
})
export class GrowthModule {}
