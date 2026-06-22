import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import { RedisService } from '../clients/redis.service';
import { QdrantService } from '../clients/qdrant.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly qdrant: QdrantService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async check() {
    const [redisResult, qdrantResult, postgresResult] = await Promise.allSettled([
      this.checkRedis(),
      this.checkQdrant(),
      this.checkPostgresTcp(),
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

  private checkPostgresTcp(): Promise<void> {
    const dbUrl = this.config.get<string>('DATABASE_URL', '');
    const parsed = new URL(dbUrl.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
    const host = parsed.hostname || '127.0.0.1';
    const port = parseInt(parsed.port || '5432', 10);

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ port, host });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('timeout'));
      }, 2000);
      socket.on('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve();
      });
      socket.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
