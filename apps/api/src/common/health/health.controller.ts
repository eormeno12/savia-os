import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../clients/redis.service';
import { QdrantService } from '../clients/qdrant.service';
import { PrismaService } from '../clients/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly qdrant: QdrantService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async check() {
    const [redisResult, qdrantResult, postgresResult] = await Promise.allSettled([
      this.checkRedis(),
      this.checkQdrant(),
      this.checkPostgres(),
    ]);

    const all = [redisResult, qdrantResult, postgresResult];

    return {
      status: all.every((r) => r.status === 'fulfilled') ? 'ok' : 'degraded',
      redis: redisResult.status === 'fulfilled' ? 'ok' : 'error',
      qdrant: qdrantResult.status === 'fulfilled' ? 'ok' : 'error',
      postgres: postgresResult.status === 'fulfilled' ? 'ok' : 'error',
    };
  }

  private async checkRedis() {
    const res = await this.redis.ping();
    if (res !== 'PONG') throw new Error('unexpected response');
  }

  private async checkQdrant() {
    const res = await fetch(`${this.qdrant.baseUrl}/healthz`);
    if (!res.ok) throw new Error(`status ${res.status}`);
  }

  private async checkPostgres() {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
