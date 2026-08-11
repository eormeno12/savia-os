import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/clients/prisma.service';
import { RedisService } from '../../common/clients/redis.service';
import { UnauthorizedError } from '../../common/errors/domain-error';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_TTL_S = 15 * 60;
// A just-rotated token re-presented within this window is treated as a benign
// concurrent refresh (two tabs / app+web), NOT theft — avoids false-positive
// family revocations. Re-use AFTER the window is genuine theft → burn the family.
const ROTATION_GRACE_MS = 15_000;

/**
 * Refresh-session lifecycle (F1.5): rotation + family revocation + reuse
 * detection (OWASP). A whole token family is born at login; each refresh rotates
 * to a new jti and revokes the old. Re-presenting a rotated token AFTER the grace
 * window is treated as theft → the entire family is revoked. Logout denylists the
 * live access jti.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async startSession(userId: string): Promise<{ jti: string; fam: string }> {
    const id = randomUUID();
    await this.prisma.authSession.create({
      data: { id, userId, familyId: id, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    return { jti: id, fam: id };
  }

  /** Validate + rotate. Throws (and nukes the family on reuse) when not valid. */
  async rotate(userId: string, jti: string, fam: string): Promise<{ jti: string }> {
    const session = await this.prisma.authSession.findUnique({ where: { id: jti } });

    if (!session || session.userId !== userId || session.familyId !== fam) {
      await this.revokeFamily(fam);
      throw new UnauthorizedError('Sesión inválida');
    }
    if (session.revokedAt && Date.now() - session.revokedAt.getTime() > ROTATION_GRACE_MS) {
      // Re-used well after rotation → genuine theft. Burn the whole family.
      await this.revokeFamily(fam);
      throw new UnauthorizedError('Reuso de refresh token detectado');
    }
    // (revoked but within grace → benign concurrent refresh: fall through and rotate)
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedError('Sesión expirada');
    }

    const newId = randomUUID();
    await this.prisma.$transaction([
      // `revokedAt: null` guard: only the FIRST rotation sets it. A benign
      // reuse within the grace window must NOT push it forward, or the grace
      // window slides indefinitely and reuse-detection never fires (a stale
      // token re-presented every <15s would loop forever undetected).
      this.prisma.authSession.updateMany({
        where: { id: jti, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.authSession.create({
        data: { id: newId, userId, familyId: fam, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
      }),
    ]);
    return { jti: newId };
  }

  /** A definitive revocation timestamp: backdated past the grace window so the
   *  token can never be "resurrected" by a concurrent refresh (logout / theft). */
  private beyondGrace(): Date {
    return new Date(Date.now() - ROTATION_GRACE_MS - 1000);
  }

  async revokeSession(jti: string): Promise<void> {
    await this.prisma.authSession.updateMany({ where: { id: jti }, data: { revokedAt: this.beyondGrace() } });
  }

  async revokeFamily(fam: string): Promise<void> {
    // Burn ALL family sessions definitively (not just the not-yet-revoked ones).
    await this.prisma.authSession.updateMany({ where: { familyId: fam }, data: { revokedAt: this.beyondGrace() } });
  }

  // Access-token denylist (logout takes effect immediately, not after 15m).
  async denylistAccess(jti: string): Promise<void> {
    await this.redis.set(`denylist:access:${jti}`, '1', 'EX', ACCESS_TTL_S);
  }

  async isAccessDenied(jti: string): Promise<boolean> {
    return (await this.redis.exists(`denylist:access:${jti}`)) === 1;
  }
}
