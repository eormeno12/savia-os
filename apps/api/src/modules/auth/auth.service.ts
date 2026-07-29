import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import type { User } from '@prisma/client';
import type { MeResponse } from '@savia-os/contracts';
import { PrismaService } from '../../common/clients/prisma.service';
import { NotFoundError, UnauthorizedError } from '../../common/errors/domain-error';
import { OtpService } from './otp.service';
import { MailService } from './mail.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { CookieHelper } from './cookies';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
    private readonly cookies: CookieHelper,
  ) {}

  async requestOtp(email: string, ip: string): Promise<void> {
    await this.otp.checkRateLimit(email, ip);
    const code = await this.otp.generateAndSave(email);
    await this.mail.sendOtp(email, code);
  }

  async verifyOtp(email: string, code: string, res: Response): Promise<MeResponse> {
    await this.otp.verify(email, code);
    const user = await this.prisma.user.upsert({ where: { email }, create: { email }, update: {} });
    await this.issue(user.id, user.email, res);
    return toMe(user);
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('Usuario no encontrado');
    return toMe(user);
  }

  async refresh(refreshToken: string | undefined, res: Response): Promise<void> {
    if (!refreshToken) throw new UnauthorizedError('Sin refresh token');
    const claims = await this.jwt.verifyRefresh(refreshToken);
    const { jti } = await this.sessions.rotate(claims.sub, claims.jti, claims.fam);
    const access = await this.jwt.signAccess({ sub: claims.sub, email: claims.email });
    const refresh = await this.jwt.signRefresh(
      { sub: claims.sub, email: claims.email },
      { jti, fam: claims.fam },
    );
    this.cookies.setAccess(res, access.token);
    this.cookies.setRefresh(res, refresh);
  }

  async logout(accessToken: string | undefined, refreshToken: string | undefined, res: Response): Promise<void> {
    if (refreshToken) {
      try {
        const c = await this.jwt.verifyRefresh(refreshToken);
        await this.sessions.revokeSession(c.jti);
      } catch {
        // already invalid — nothing to revoke
      }
    }
    if (accessToken) {
      try {
        const p = await this.jwt.verifyAccess(accessToken);
        await this.sessions.denylistAccess(p.jti);
      } catch {
        // expired/invalid — denylist not needed
      }
    }
    this.cookies.clear(res);
  }

  private async issue(userId: string, email: string, res: Response): Promise<void> {
    const { jti, fam } = await this.sessions.startSession(userId);
    const access = await this.jwt.signAccess({ sub: userId, email });
    const refresh = await this.jwt.signRefresh({ sub: userId, email }, { jti, fam });
    this.cookies.setAccess(res, access.token);
    this.cookies.setRefresh(res, refresh);
  }
}

function toMe(user: User): MeResponse {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    plan: user.plan,
    createdAt: user.createdAt.toISOString(),
  };
}
