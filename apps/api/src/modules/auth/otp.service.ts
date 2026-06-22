import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/clients/prisma.service';
import { RedisService } from '../../common/clients/redis.service';

const OTP_TTL_MINUTES = 10;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 3600; // 1 hora

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async generateAndSave(email: string): Promise<string> {
    const code = String(randomInt(100000, 999999));
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.prisma.otpCode.create({ data: { email, codeHash, expiresAt } });
    return code;
  }

  async checkRateLimit(email: string, ip: string): Promise<void> {
    const emailKey = `otp:req:${email}`;
    const ipKey = `otp:req:ip:${ip}`;

    const [emailCount, ipCount] = await Promise.all([
      this.incrementWithExpiry(emailKey),
      this.incrementWithExpiry(ipKey),
    ]);

    if (emailCount > RATE_LIMIT_MAX || ipCount > RATE_LIMIT_MAX) {
      throw new BadRequestException('Demasiados intentos. Espera un momento.');
    }
  }

  async verify(email: string, code: string): Promise<void> {
    const record = await this.prisma.otpCode.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Código inválido o expirado.');
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });

    if (record.attempts >= 5) {
      throw new BadRequestException('Demasiados intentos. Solicita un nuevo código.');
    }

    const valid = await argon2.verify(record.codeHash, code);
    if (!valid) {
      throw new BadRequestException('Código incorrecto.');
    }

    await this.prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }

  private async incrementWithExpiry(key: string): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, RATE_LIMIT_WINDOW);
    return count;
  }
}
