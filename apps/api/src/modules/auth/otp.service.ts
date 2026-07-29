import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/clients/prisma.service';
import { RedisService } from '../../common/clients/redis.service';
import { RateLimitError, UnauthorizedError } from '../../common/errors/domain-error';

const OTP_TTL_MINUTES = 10;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 3600; // 1h
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async generateAndSave(email: string): Promise<string> {
    const code = String(randomInt(100000, 999999));
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await this.prisma.$transaction([
      // un código nuevo invalida los anteriores: solo el más reciente debe poder usarse.
      this.prisma.otpCode.updateMany({
        where: { email, consumedAt: null, supersededAt: null },
        data: { supersededAt: new Date() },
      }),
      this.prisma.otpCode.create({ data: { email, codeHash, expiresAt } }),
    ]);
    return code;
  }

  async checkRateLimit(email: string, ip: string): Promise<void> {
    const [emailCount, ipCount] = await Promise.all([
      this.bump(`otp:req:${email}`),
      this.bump(`otp:req:ip:${ip}`),
    ]);
    if (emailCount > RATE_LIMIT_MAX || ipCount > RATE_LIMIT_MAX) {
      throw new RateLimitError('Demasiados intentos. Espera un momento.');
    }
  }

  async verify(email: string, code: string): Promise<void> {
    const record = await this.prisma.otpCode.findFirst({
      where: { email, consumedAt: null, supersededAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new UnauthorizedError('Código inválido o expirado.');

    // Atomic check-and-increment: the `attempts: {lt: MAX_ATTEMPTS}` filter is
    // enforced by Postgres' row lock on the UPDATE itself, not a separate
    // read-then-write in application code, so concurrent guesses for the same
    // code can't race past the cap.
    const { count } = await this.prisma.otpCode.updateMany({
      where: { id: record.id, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (count === 0) {
      throw new RateLimitError('Demasiados intentos. Solicita un nuevo código.');
    }

    if (!(await argon2.verify(record.codeHash, code))) {
      throw new UnauthorizedError('Código incorrecto.');
    }
    await this.prisma.otpCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  }

  private async bump(key: string): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, RATE_LIMIT_WINDOW);
    return count;
  }
}
