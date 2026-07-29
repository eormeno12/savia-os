import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHmac, randomBytes } from 'node:crypto';
import { AppConfig } from '../../common/config/app.config';

const PREFIX = 'savia_';

/**
 * MCP connection tokens. Two derivations of the raw token (spec 15 / B1·B3):
 *  - `hash`   argon2id — for slow, constant-time VERIFICATION.
 *  - `lookup` HMAC-SHA256 — deterministic, indexed → O(1) FIND + a single cache
 *             key. Replaces the O(N) argon2 table scan.
 */
@Injectable()
export class TokenService {
  private readonly hmacKey: string;

  constructor(config: AppConfig) {
    this.hmacKey = config.mcpTokenHmacKey;
  }

  generate(): string {
    return PREFIX + randomBytes(32).toString('base64url');
  }

  hash(token: string): Promise<string> {
    return argon2.hash(token, { type: argon2.argon2id });
  }

  verify(token: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, token);
  }

  lookup(token: string): string {
    return createHmac('sha256', this.hmacKey).update(token).digest('base64url');
  }
}
