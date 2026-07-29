import { RetentionWorker } from './retention.worker';
import type { PrismaService } from '../../common/clients/prisma.service';

function mockPrisma() {
  const ok = (count = 0) => jest.fn().mockResolvedValue({ count });
  return {
    authSession: { deleteMany: ok() },
    connection: { deleteMany: ok() },
    otpCode: { deleteMany: ok() },
    outboxEvent: { deleteMany: ok(), updateMany: ok(3) },
    accessLog: { deleteMany: ok() },
    webhookEvent: { deleteMany: ok() },
  } as unknown as PrismaService;
}

describe('RetentionWorker.purge', () => {
  it('resurrects every failed OutboxEvent to pending, resetting attempts, without touching lastError', async () => {
    const prisma = mockPrisma();
    await new RetentionWorker(prisma).purge();

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { status: 'failed' },
      data: { status: 'pending', attempts: 0, nextAttemptAt: null },
    });
    const data = (prisma.outboxEvent.updateMany as jest.Mock).mock.calls[0][0].data;
    expect(data).not.toHaveProperty('lastError'); // forensic trail preserved on purpose
  });

  it('runs every existing housekeeping deletion alongside the new resurrection', async () => {
    const prisma = mockPrisma();
    await new RetentionWorker(prisma).purge();

    expect(prisma.authSession.deleteMany).toHaveBeenCalled();
    expect(prisma.connection.deleteMany).toHaveBeenCalled();
    expect(prisma.otpCode.deleteMany).toHaveBeenCalled();
    expect(prisma.outboxEvent.deleteMany).toHaveBeenCalled();
    expect(prisma.accessLog.deleteMany).toHaveBeenCalled();
    expect(prisma.webhookEvent.deleteMany).toHaveBeenCalled();
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalled();
  });

  it('swallows errors so a single failing cron tick does not crash the worker process', async () => {
    const prisma = mockPrisma();
    (prisma.authSession.deleteMany as jest.Mock).mockRejectedValue(new Error('db down'));
    await expect(new RetentionWorker(prisma).purge()).resolves.toBeUndefined();
  });
});
