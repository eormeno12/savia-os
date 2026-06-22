import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, jwtVerify } from 'jose';
import type { JwtPayload } from './decorators/current-user.decorator';

@Injectable()
export class JwtService {
  private readonly accessSecret: Uint8Array;
  private readonly refreshSecret: Uint8Array;

  constructor(config: ConfigService) {
    const enc = new TextEncoder();
    this.accessSecret = enc.encode(config.get<string>('JWT_SECRET', 'dev-access-secret'));
    this.refreshSecret = enc.encode(config.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret'));
  }

  signAccess(payload: JwtPayload): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setExpirationTime('15m')
      .setIssuedAt()
      .sign(this.accessSecret);
  }

  signRefresh(payload: JwtPayload): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setExpirationTime('30d')
      .setIssuedAt()
      .sign(this.refreshSecret);
  }

  async verifyAccess(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret);
      return { sub: payload.sub as string, email: payload['email'] as string };
    } catch {
      throw new UnauthorizedException();
    }
  }

  async verifyRefresh(token: string): Promise<JwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.refreshSecret);
      return { sub: payload.sub as string, email: payload['email'] as string };
    } catch {
      throw new UnauthorizedException();
    }
  }
}
