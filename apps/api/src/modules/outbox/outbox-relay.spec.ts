import { OutboxRelay } from './outbox-relay';
import { MAX_ATTEMPTS } from './backoff';
import type { PrismaService } from '../../common/clients/prisma.service';
import type { VectorStorePort } from '../../common/ports/vector-store.port';

function prismaWith(events: Array<Record<string, unknown>>) {
  const findMany = jest.fn().mockResolvedValue(events);
  const update = jest.fn().mockResolvedValue({});
  return {
    prisma: { outboxEvent: { findMany, update } } as unknown as PrismaService,
    findMany,
    update,
  };
}

function event(overrides: Partial<{ id: string; kind: string; memoryId: string | null; attempts: number }> = {}) {
  return { id: 'evt-1', kind: 'set_payload', memoryId: 'mem-1', attempts: 0, payload: {}, ...overrides };
}

describe('OutboxRelay.processBatch', () => {
  it('queries only pending events whose nextAttemptAt is null or already due', async () => {
    const { prisma, findMany } = prismaWith([]);
    const vectors = { setPayload: jest.fn() } as unknown as VectorStorePort;
    await new OutboxRelay(prisma, vectors).processBatch();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending',
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: expect.any(Date) } }],
        }),
      }),
    );
  });

  it('marks a set_payload event committed on success', async () => {
    const { prisma, update } = prismaWith([event()]);
    const vectors = { setPayload: jest.fn().mockResolvedValue(undefined) } as unknown as VectorStorePort;
    const committed = await new OutboxRelay(prisma, vectors).processBatch();

    expect(committed).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: { status: 'committed', committedAt: expect.any(Date) },
    });
  });

  it('on failure below MAX_ATTEMPTS, stays pending with a future nextAttemptAt', async () => {
    const { prisma, update } = prismaWith([event({ attempts: 0 })]);
    const vectors = { setPayload: jest.fn().mockRejectedValue(new Error('qdrant down')) } as unknown as VectorStorePort;
    await new OutboxRelay(prisma, vectors).processBatch();

    const call = update.mock.calls[0][0];
    expect(call.data.status).toBe('pending');
    expect(call.data.attempts).toBe(1);
    expect(call.data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('on failure reaching MAX_ATTEMPTS, transitions to failed with nextAttemptAt null', async () => {
    const { prisma, update } = prismaWith([event({ attempts: MAX_ATTEMPTS - 1 })]);
    const vectors = { setPayload: jest.fn().mockRejectedValue(new Error('still down')) } as unknown as VectorStorePort;
    await new OutboxRelay(prisma, vectors).processBatch();

    const call = update.mock.calls[0][0];
    expect(call.data.status).toBe('failed');
    expect(call.data.attempts).toBe(MAX_ATTEMPTS);
    expect(call.data.nextAttemptAt).toBeNull();
  });

  it('delete_payload throws and retries instead of silently committing (no producers exist yet)', async () => {
    const { prisma, update } = prismaWith([event({ kind: 'delete_payload' })]);
    const vectors = { setPayload: jest.fn() } as unknown as VectorStorePort;
    const committed = await new OutboxRelay(prisma, vectors).processBatch();

    expect(committed).toBe(0);
    expect(vectors.setPayload).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'pending' }) }));
  });

  it('a failing event does not block a later succeeding one in the same batch', async () => {
    const { prisma, update } = prismaWith([event({ id: 'evt-fail', memoryId: 'mem-fail' }), event({ id: 'evt-ok', memoryId: 'mem-ok' })]);
    const setPayload = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
    const vectors = { setPayload } as unknown as VectorStorePort;
    const committed = await new OutboxRelay(prisma, vectors).processBatch();

    expect(committed).toBe(1);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
