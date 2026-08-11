import { Injectable } from '@nestjs/common';
import { RedisService } from '../../common/clients/redis.service';

const TTL_SECONDS = 60;

/** The token→connection resolution. The access filter is rebuilt fresh per call
 *  (grants are tiny), so only this cheap mapping is cached — keyed by the SAME
 *  `tokenLookup` used everywhere, so invalidation actually hits it (closes B1). */
export interface ResolvedConnection {
  connectionId: string;
  userId: string;
  label: string; // etiqueta de la conexión → sourceLabel de las memorias que crea (Pulso)
}

@Injectable()
export class GrantsCache {
  constructor(private readonly redis: RedisService) {}

  private key(tokenLookup: string): string {
    return `mcp:token:${tokenLookup}`;
  }

  async get(tokenLookup: string): Promise<ResolvedConnection | null> {
    const raw = await this.redis.get(this.key(tokenLookup));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ResolvedConnection;
    } catch {
      return null;
    }
  }

  async set(tokenLookup: string, value: ResolvedConnection): Promise<void> {
    await this.redis.set(this.key(tokenLookup), JSON.stringify(value), 'EX', TTL_SECONDS);
  }

  /**
   * Strict: revoke() depends on this actually clearing the cache (else a revoked
   * token could keep resolving from a stale entry for up to TTL_SECONDS). A
   * transient Redis blip is retried a few times; if it still fails, this throws
   * so the caller (revoke) surfaces the failure instead of returning 200 over a
   * cache that may still be poisoned.
   */
  async invalidate(tokenLookup: string): Promise<void> {
    const attempts = 3;
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.redis.del(this.key(tokenLookup));
        return;
      } catch (err) {
        if (i === attempts) throw err;
        await new Promise((r) => setTimeout(r, 50 * i));
      }
    }
  }
}
