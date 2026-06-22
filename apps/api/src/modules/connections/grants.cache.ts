import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/clients/redis.service';

const TTL_SECONDS = 60;

export interface ResolvedToken {
  connectionId: string;
  userId: string;
  spaceIds: string[];
}

@Injectable()
export class GrantsCache {
  private readonly logger = new Logger(GrantsCache.name);

  constructor(private readonly redis: RedisService) {}

  private key(tokenHash: string): string {
    return `mcp:token:${tokenHash}`;
  }

  async get(tokenHash: string): Promise<ResolvedToken | null> {
    const raw = await this.redis.get(this.key(tokenHash));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ResolvedToken;
    } catch {
      return null;
    }
  }

  async set(tokenHash: string, value: ResolvedToken): Promise<void> {
    await this.redis.set(this.key(tokenHash), JSON.stringify(value), 'EX', TTL_SECONDS);
  }

  async invalidate(tokenHash: string): Promise<void> {
    await this.redis.del(this.key(tokenHash));
    this.logger.debug(`invalidated cache for token hash`);
  }
}
