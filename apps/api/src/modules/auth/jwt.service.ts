import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { AppConfig } from '../../common/config/app.config';
import { UnauthorizedError } from '../../common/errors/domain-error';
import type { JwtPayload } from './decorators/current-user.decorator';

export interface RefreshClaims {
  sub: string;
  email: string;
  jti: string;
  fam: string; // session family
}

@Injectable()
export class JwtService {
  private readonly accessSecret: Uint8Array;
  private readonly refreshSecret: Uint8Array;

  constructor(config: AppConfig) {
    const enc = new TextEncoder();
    this.accessSecret = enc.encode(config.jwtSecret);
    this.refreshSecret = enc.encode(config.jwtRefreshSecret);
  }

  /** Short-lived access token with its own jti (for the logout denylist). */
  async signAccess(p: { sub: string; email: string }): Promise<{ token: string; jti: string }> {
    const jti = randomUUID();
    const token = await new SignJWT({ email: p.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(p.sub)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(this.accessSecret);
    return { token, jti };
  }

  /** Long-lived refresh token; jti = AuthSession id, fam = session family. */
  signRefresh(p: { sub: string; email: string }, opts: { jti: string; fam: string }): Promise<string> {
    return new SignJWT({ email: p.email, fam: opts.fam })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(p.sub)
      .setJti(opts.jti)
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(this.refreshSecret);
  }

  async verifyAccess(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret);
      return { sub: payload.sub as string, email: payload['email'] as string, jti: payload.jti as string };
    } catch {
      throw new UnauthorizedError('Sesión inválida');
    }
  }

  async verifyRefresh(token: string): Promise<RefreshClaims> {
    try {
      const { payload } = await jwtVerify(token, this.refreshSecret);
      return {
        sub: payload.sub as string,
        email: payload['email'] as string,
        jti: payload.jti as string,
        fam: payload['fam'] as string,
      };
    } catch {
      throw new UnauthorizedError('Refresh inválido');
    }
  }
}
