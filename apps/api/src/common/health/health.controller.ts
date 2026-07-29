import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RedisService } from '../clients/redis.service';
import { QdrantConnection } from '../adapters/qdrant.connection';
import { PrismaService } from '../clients/prisma.service';
import { Public } from '../../modules/auth/decorators/public.decorator';

/**
 * Real dependency healthcheck (F8.3): pings Postgres, Qdrant and Redis. Returns
 * 503 with `degraded` when a dep is down so a load balancer (or Docker's own
 * `healthcheck`, which only looks at the status code) can route around it.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly qdrant: QdrantConnection,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const [redis, qdrant, postgres] = await Promise.allSettled([
      this.checkRedis(),
      this.checkQdrant(),
      this.checkPostgres(),
    ]);
    const ok = (r: PromiseSettledStatus) => (r.status === 'fulfilled' ? 'ok' : 'error');
    const healthy = [redis, qdrant, postgres].every((r) => r.status === 'fulfilled');
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: healthy ? 'ok' : 'degraded',
      deps: { postgres: ok(postgres), qdrant: ok(qdrant), redis: ok(redis) },
    };
  }

  private async checkRedis(): Promise<void> {
    if ((await this.redis.ping()) !== 'PONG') throw new Error('unexpected ping response');
  }

  private async checkQdrant(): Promise<void> {
    const res = await fetch(`${this.qdrant.baseUrl}/healthz`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  }

  private async checkPostgres(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}

type PromiseSettledStatus = PromiseSettledResult<unknown>;
