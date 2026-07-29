import { OtpService } from './otp.service';
import type { PrismaService } from '../../common/clients/prisma.service';
import type { RedisService } from '../../common/clients/redis.service';
import { RateLimitError, UnauthorizedError } from '../../common/errors/domain-error';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  verify: jest.fn(),
}));
const argon2 = jest.requireMock('argon2');

function mockPrisma() {
  // Default: the attempts check-and-increment "succeeds" (row matched).
  // Individual tests override this to simulate the cap being hit.
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const create = jest.fn().mockResolvedValue({});
  const findFirst = jest.fn().mockResolvedValue(null);
  const update = jest.fn().mockResolvedValue({});
  return {
    prisma: {
      otpCode: { updateMany, create, findFirst, update },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService,
    updateMany,
    create,
    findFirst,
    update,
  };
}

function mockRedis() {
  return { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(undefined) } as unknown as RedisService;
}

describe('OtpService.generateAndSave', () => {
  it('supersedes every other still-pending code for that email before creating the new one', async () => {
    const { prisma, updateMany, create } = mockPrisma();
    await new OtpService(prisma, mockRedis()).generateAndSave('alice@savia.app');

    expect(updateMany).toHaveBeenCalledWith({
      where: { email: 'alice@savia.app', consumedAt: null, supersededAt: null },
      data: { supersededAt: expect.any(Date) },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'alice@savia.app' }),
    });
  });
});

describe('OtpService.verify', () => {
  it('only matches codes that are unconsumed, unsuperseded, and unexpired', async () => {
    const { prisma, findFirst } = mockPrisma();
    await expect(new OtpService(prisma, mockRedis()).verify('alice@savia.app', '123456')).rejects.toThrow(
      UnauthorizedError,
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        email: 'alice@savia.app',
        consumedAt: null,
        supersededAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('rejects once attempts reach the cap without consuming another attempt', async () => {
    const { prisma, updateMany, update } = mockPrisma();
    (prisma.otpCode.findFirst as jest.Mock).mockResolvedValue({ id: 'otp-1', codeHash: 'hashed', attempts: 5 });
    // Simulates the `attempts: {lt: MAX_ATTEMPTS}` filter matching 0 rows.
    updateMany.mockResolvedValue({ count: 0 });

    await expect(new OtpService(prisma, mockRedis()).verify('alice@savia.app', '123456')).rejects.toThrow(
      RateLimitError,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('does not let concurrent guesses race past the attempts cap (atomic check-and-increment)', async () => {
    const { prisma, updateMany } = mockPrisma();
    (prisma.otpCode.findFirst as jest.Mock).mockResolvedValue({ id: 'otp-1', codeHash: 'hashed', attempts: 4 });
    updateMany.mockResolvedValue({ count: 0 }); // another concurrent guess already claimed the last attempt

    await expect(new OtpService(prisma, mockRedis()).verify('alice@savia.app', '123456')).rejects.toThrow(
      RateLimitError,
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'otp-1', attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
  });

  it('marks the record consumed on a correct guess', async () => {
    const { prisma, updateMany, update } = mockPrisma();
    (prisma.otpCode.findFirst as jest.Mock).mockResolvedValue({ id: 'otp-1', codeHash: 'hashed', attempts: 0 });
    argon2.verify.mockResolvedValue(true);

    await new OtpService(prisma, mockRedis()).verify('alice@savia.app', '123456');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'otp-1', attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: 'otp-1' }, data: { consumedAt: expect.any(Date) } });
  });

  it('rejects a wrong guess without marking the record consumed', async () => {
    const { prisma, updateMany, update } = mockPrisma();
    (prisma.otpCode.findFirst as jest.Mock).mockResolvedValue({ id: 'otp-1', codeHash: 'hashed', attempts: 0 });
    argon2.verify.mockResolvedValue(false);

    await expect(new OtpService(prisma, mockRedis()).verify('alice@savia.app', '000000')).rejects.toThrow(
      UnauthorizedError,
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'otp-1', attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ data: { consumedAt: expect.any(Date) } }));
  });
});
