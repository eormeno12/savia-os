import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

const PREFIX = 'savia_';

@Injectable()
export class TokenService {
  generate(): string {
    const bytes = randomBytes(32);
    return PREFIX + bytes.toString('base64url');
  }

  hash(token: string): Promise<string> {
    return argon2.hash(token, { type: argon2.argon2id });
  }

  verify(token: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, token);
  }
}
