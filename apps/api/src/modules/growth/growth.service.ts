import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/clients/prisma.service';
import { RedisService } from '../../common/clients/redis.service';

const AREAS_TTL = 60; // seconds

export interface AreaDto {
  spaceId: string;
  name: string;
  count: number;
  share: number;
}

export interface GrowthPoint {
  bucket: string;
  spaceId: string;
  spaceName: string;
  count: number;
}

export interface GrowthSummary {
  points: GrowthPoint[];
  todayTotal: number;
  weekTotal: number;
  weekDelta: number;
}

export interface AccessActivity {
  connectionId: string;
  label: string;
  totalCalls: number;
  lastSeenAt: string | null;
}

@Injectable()
export class GrowthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAreas(userId: string): Promise<AreaDto[]> {
    const cacheKey = `growth:areas:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const spaces = await this.prisma.space.findMany({
      where: { userId },
      select: { id: true, name: true },
    });

    if (spaces.length === 0) {
      await this.redis.setex(cacheKey, AREAS_TTL, '[]');
      return [];
    }

    // Count memories per space from MemoryIndex (faster than Qdrant)
    const counts = await this.prisma.$queryRaw<{ spaceId: string; cnt: bigint }[]>`
      SELECT unnest("spaceIds") AS "spaceId", COUNT(*) AS cnt
      FROM "MemoryIndex"
      WHERE "userId" = ${userId}
      GROUP BY "spaceId"
    `;

    const countMap = new Map(counts.map((r) => [r.spaceId, Number(r.cnt)]));
    const total = counts.reduce((s, r) => s + Number(r.cnt), 0) || 1;

    const areas: AreaDto[] = spaces.map((s) => {
      const count = countMap.get(s.id) ?? 0;
      return { spaceId: s.id, name: s.name, count, share: Math.round((count / total) * 100) };
    });

    areas.sort((a, b) => b.count - a.count);

    await this.redis.setex(cacheKey, AREAS_TTL, JSON.stringify(areas));
    return areas;
  }

  async invalidateAreasCache(userId: string): Promise<void> {
    await this.redis.del(`growth:areas:${userId}`);
  }

  async getGrowth(userId: string, range: 'day' | 'week'): Promise<GrowthSummary> {
    const now = new Date();
    const since = new Date(now);
    if (range === 'day') {
      since.setDate(since.getDate() - 1);
    } else {
      since.setDate(since.getDate() - 7);
    }
    const prevSince = new Date(since);
    prevSince.setDate(prevSince.getDate() - 7);

    const granularity = range === 'day' ? 'hour' : 'day';

    const rows = await this.prisma.$queryRaw<
      { bucket: Date; spaceId: string | null; cnt: bigint }[]
    >`
      SELECT
        date_trunc(${granularity}, ge."createdAt") AS bucket,
        ge."spaceId",
        COUNT(*) AS cnt
      FROM "GrowthEvent" ge
      WHERE ge."userId" = ${userId}
        AND ge."createdAt" >= ${since}
      GROUP BY bucket, ge."spaceId"
      ORDER BY bucket
    `;

    // Get space names for the spaceIds found
    const spaceIds = [...new Set(rows.map((r) => r.spaceId).filter(Boolean))] as string[];
    const spaces = spaceIds.length > 0
      ? await this.prisma.space.findMany({
          where: { id: { in: spaceIds } },
          select: { id: true, name: true },
        })
      : [];
    const spaceNames = new Map(spaces.map((s) => [s.id, s.name]));

    const points: GrowthPoint[] = rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      spaceId: r.spaceId ?? '',
      spaceName: r.spaceId ? (spaceNames.get(r.spaceId) ?? r.spaceId) : 'Sin clasificar',
      count: Number(r.cnt),
    }));

    // Today total
    const todaySince = new Date(now);
    todaySince.setHours(0, 0, 0, 0);
    const todayRows = await this.prisma.growthEvent.count({
      where: { userId, createdAt: { gte: todaySince } },
    });

    // This week total
    const weekSince = new Date(now);
    weekSince.setDate(weekSince.getDate() - 7);
    const weekTotal = await this.prisma.growthEvent.count({
      where: { userId, createdAt: { gte: weekSince } },
    });

    // Previous week total (for delta)
    const prevWeekSince = new Date(weekSince);
    prevWeekSince.setDate(prevWeekSince.getDate() - 7);
    const prevWeekTotal = await this.prisma.growthEvent.count({
      where: { userId, createdAt: { gte: prevWeekSince, lt: weekSince } },
    });

    return {
      points,
      todayTotal: todayRows,
      weekTotal,
      weekDelta: weekTotal - prevWeekTotal,
    };
  }

  async getAccessActivity(userId: string): Promise<AccessActivity[]> {
    // Group access_log by connection, scoped to this user's connections
    const connections = await this.prisma.connection.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        label: true,
        lastSeenAt: true,
        _count: { select: { accessLog: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 20,
    });

    return connections.map((c) => ({
      connectionId: c.id,
      label: c.label,
      totalCalls: c._count.accessLog,
      lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
    }));
  }
}
