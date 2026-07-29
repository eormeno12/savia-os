import { VectorGarbageCollector } from './vector-gc';
import { MAX_ATTEMPTS } from './backoff';
import type { PrismaService } from '../../common/clients/prisma.service';
import type { VectorStorePort } from '../../common/ports/vector-store.port';

function prismaWith(events: Array<Record<string, unknown>>) {
  const findMany = jest.fn().mockResolvedValue(events);
  const update = jest.fn().mockResolvedValue({});
  const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
  const create = jest.fn().mockResolvedValue({});
  return {
    prisma: {
      outboxEvent: { findMany, update },
      memoryIndex: { deleteMany },
      accessLog: { create },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService,
    findMany,
    update,
    deleteMany,
    create,
  };
}

function purgeEvent(overrides: Partial<{ id: string; memoryId: string | null; attempts: number; graceUntil: number }> = {}) {
  const { graceUntil = 0, ...rest } = overrides;
  return { id: 'evt-1', memoryId: 'mem-1', attempts: 0, payload: { graceUntil, reason: 'user_delete' }, ...rest };
}

describe('VectorGarbageCollector.processPurges', () => {
  it('queries only pending purge events whose nextAttemptAt is null or already due', async () => {
    const { prisma, findMany } = prismaWith([]);
    const vectors = { deletePoints: jest.fn() } as unknown as VectorStorePort;
    await new VectorGarbageCollector(prisma, vectors).processPurges();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending',
          kind: 'purge',
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: expect.any(Date) } }],
        }),
      }),
    );
  });

  it('skips a row whose grace window has not elapsed (reversible undo window, untouched)', async () => {
    const { prisma, update } = prismaWith([purgeEvent({ graceUntil: Date.now() + 60_000 })]);
    const vectors = { deletePoints: jest.fn() } as unknown as VectorStorePort;
    const purged = await new VectorGarbageCollector(prisma, vectors).processPurges();

    expect(purged).toBe(0);
    expect(update).not.toHaveBeenCalled();
    expect(vectors.deletePoints).not.toHaveBeenCalled();
  });

  it('on failure below MAX_ATTEMPTS, stays pending with a future nextAttemptAt (the core bug: this used to retry forever with no cap)', async () => {
    const { prisma, update } = prismaWith([purgeEvent({ attempts: 0 })]);
    const vectors = { deletePoints: jest.fn().mockRejectedValue(new Error('qdrant down')) } as unknown as VectorStorePort;
    await new VectorGarbageCollector(prisma, vectors).processPurges();

    const call = update.mock.calls[0][0];
    expect(call.data.status).toBe('pending');
    expect(call.data.attempts).toBe(1);
    expect(call.data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('on failure reaching MAX_ATTEMPTS, now transitions to failed (previously impossible)', async () => {
    const { prisma, update } = prismaWith([purgeEvent({ attempts: MAX_ATTEMPTS - 1 })]);
    const vectors = { deletePoints: jest.fn().mockRejectedValue(new Error('still down')) } as unknown as VectorStorePort;
    await new VectorGarbageCollector(prisma, vectors).processPurges();

    const call = update.mock.calls[0][0];
    expect(call.data.status).toBe('failed');
    expect(call.data.nextAttemptAt).toBeNull();
  });

  it('on success, deletes the vector + MemoryIndex row, writes the audit row, and marks committed', async () => {
    const { prisma, update, deleteMany, create } = prismaWith([purgeEvent()]);
    const vectors = { deletePoints: jest.fn().mockResolvedValue(undefined) } as unknown as VectorStorePort;
    const purged = await new VectorGarbageCollector(prisma, vectors).processPurges();

    expect(purged).toBe(1);
    expect(deleteMany).toHaveBeenCalledWith({ where: { memoryId: 'mem-1' } });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'purge:user_delete' }) }),
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'committed' }) }));
  });

  it('a failing audit write retries the whole purge instead of silently completing without one', async () => {
    const { prisma, update } = prismaWith([purgeEvent()]);
    (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('accessLog write failed'));
    const vectors = { deletePoints: jest.fn().mockResolvedValue(undefined) } as unknown as VectorStorePort;
    const purged = await new VectorGarbageCollector(prisma, vectors).processPurges();

    expect(purged).toBe(0);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pending', attempts: 1 }) }),
    );
  });
});
