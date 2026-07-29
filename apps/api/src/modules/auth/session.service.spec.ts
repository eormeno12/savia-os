import { SessionService } from './session.service';
import type { PrismaService } from '../../common/clients/prisma.service';
import type { RedisService } from '../../common/clients/redis.service';
import { UnauthorizedError } from '../../common/errors/domain-error';

interface Row {
  id: string;
  userId: string;
  familyId: string;
  revokedAt: Date | null;
  expiresAt: Date;
}

/** Faithful-enough in-memory Prisma double: `updateMany`'s `where` clause is
 *  actually honored (unlike a plain jest.fn), which is exactly what the
 *  regression below needs to prove. */
function mockPrisma(seed: Row[]) {
  const rows = new Map(seed.map((r) => [r.id, { ...r }]));
  const findUnique = jest.fn(({ where: { id } }: { where: { id: string } }) =>
    Promise.resolve(rows.get(id) ?? null),
  );
  const updateMany = jest.fn(
    ({ where, data }: { where: { id?: string; familyId?: string; revokedAt?: null }; data: Partial<Row> }) => {
      let count = 0;
      for (const row of rows.values()) {
        if (where.id !== undefined && row.id !== where.id) continue;
        if (where.familyId !== undefined && row.familyId !== where.familyId) continue;
        if ('revokedAt' in where && row.revokedAt !== where.revokedAt) continue;
        Object.assign(row, data);
        count++;
      }
      return Promise.resolve({ count });
    },
  );
  const create = jest.fn(({ data }: { data: Row }) => {
    rows.set(data.id, { ...data });
    return Promise.resolve(rows.get(data.id));
  });
  const prisma = {
    authSession: { findUnique, updateMany, create },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  return { prisma, rows };
}

const mockRedis = () => ({}) as unknown as RedisService;

describe('SessionService.rotate — grace window', () => {
  it('tolerates a concurrent reuse within grace and rotates to a new session', async () => {
    jest.useFakeTimers().setSystemTime(0);
    const { prisma, rows } = mockPrisma([
      { id: 'jti1', userId: 'u1', familyId: 'fam1', revokedAt: null, expiresAt: new Date(Date.now() + 1e9) },
    ]);
    const service = new SessionService(prisma, mockRedis());

    const { jti: jti2 } = await service.rotate('u1', 'jti1', 'fam1');

    expect(rows.get('jti1')!.revokedAt).toEqual(new Date(0));
    expect(rows.get(jti2)).toBeDefined();
    jest.useRealTimers();
  });

  it('does NOT push the grace window forward on a benign reuse (regression)', async () => {
    jest.useFakeTimers().setSystemTime(0);
    const { prisma, rows } = mockPrisma([
      { id: 'jti1', userId: 'u1', familyId: 'fam1', revokedAt: null, expiresAt: new Date(Date.now() + 1e9) },
    ]);
    const service = new SessionService(prisma, mockRedis());

    // t=0: first rotation.
    await service.rotate('u1', 'jti1', 'fam1');
    expect(rows.get('jti1')!.revokedAt).toEqual(new Date(0));

    // t=5s: someone re-presents the now-stale jti1 within grace — tolerated,
    // but jti1's revokedAt must stay anchored at t=0, not slide to t=5s.
    jest.setSystemTime(5_000);
    await service.rotate('u1', 'jti1', 'fam1');
    expect(rows.get('jti1')!.revokedAt).toEqual(new Date(0));

    // t=16s (i.e. 16s after the ORIGINAL rotation, only 11s after the last
    // reuse) — with the anchor fixed at t=0, this must now be caught as theft.
    jest.setSystemTime(16_000);
    await expect(service.rotate('u1', 'jti1', 'fam1')).rejects.toThrow(UnauthorizedError);
    // Theft detection burns the whole family.
    for (const row of rows.values()) expect(row.revokedAt).not.toBeNull();

    jest.useRealTimers();
  });
});
