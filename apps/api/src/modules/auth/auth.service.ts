import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { PrismaService } from '../../common/clients/prisma.service';
import { OtpService } from './otp.service';
import { MailService } from './mail.service';
import { JwtService } from './jwt.service';

const COOKIE_OPTS_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async requestOtp(email: string, ip: string): Promise<void> {
    await this.otp.checkRateLimit(email, ip);
    const code = await this.otp.generateAndSave(email);
    await this.mail.sendOtp(email, code);
  }

  async verifyOtp(email: string, code: string, res: Response): Promise<{ id: string; email: string; createdAt: string }> {
    await this.otp.verify(email, code);

    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email },
      update: {},
    });

    const payload = { sub: user.id, email: user.email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAccess(payload),
      this.jwt.signRefresh(payload),
    ]);

    const domain = this.config.get<string>('COOKIE_DOMAIN', 'localhost');
    const secure = domain !== 'localhost';
    const opts = { ...COOKIE_OPTS_BASE, domain, secure };

    res.cookie('access_token', accessToken, { ...opts, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...opts, maxAge: 30 * 24 * 60 * 60 * 1000 });

    return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
  }

  async refresh(refreshToken: string, res: Response): Promise<void> {
    const payload = await this.jwt.verifyRefresh(refreshToken);
    const accessToken = await this.jwt.signAccess(payload);

    const domain = this.config.get<string>('COOKIE_DOMAIN', 'localhost');
    const secure = domain !== 'localhost';
    res.cookie('access_token', accessToken, {
      ...COOKIE_OPTS_BASE,
      domain,
      secure,
      maxAge: 15 * 60 * 1000,
    });
  }

  clearCookies(res: Response): void {
    const domain = this.config.get<string>('COOKIE_DOMAIN', 'localhost');
    res.clearCookie('access_token', { domain, path: '/' });
    res.clearCookie('refresh_token', { domain, path: '/' });
  }
}
