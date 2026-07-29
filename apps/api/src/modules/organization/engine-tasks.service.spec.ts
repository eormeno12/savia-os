import { EngineTasksService, enqueueMemoryTask } from './engine-tasks.service';
import { MAX_ATTEMPTS } from '../outbox/backoff';
import type { PrismaService } from '../../common/clients/prisma.service';
import type { EngineTask, Prisma } from '@prisma/client';

function makeService() {
  const update = jest.fn().mockResolvedValue({});
  const del = jest.fn().mockResolvedValue({});
  const upsert = jest.fn().mockResolvedValue({});
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    engineTask: { update, delete: del, upsert, findMany },
  } as unknown as PrismaService;
  return { svc: new EngineTasksService(prisma), update, del, upsert, findMany };
}

const task = (over: Partial<EngineTask> = {}): EngineTask =>
  ({ id: 'evt-1', userId: 'u', kind: 'rebuild_component', payload: {}, dedupeKey: null, status: 'pending', attempts: 0, lastError: null, nextAttemptAt: null, createdAt: new Date(), ...over }) as EngineTask;

describe('EngineTasksService', () => {
  it('completes by deleting the row (frees any coalescing dedupeKey)', async () => {
    const { svc, del } = makeService();
    await svc.complete('evt-1');
    expect(del).toHaveBeenCalledWith({ where: { id: 'evt-1' } });
  });

  it('on failure below MAX_ATTEMPTS, stays pending with a future nextAttemptAt', async () => {
    const { svc, update } = makeService();
    await svc.fail(task({ attempts: 0 }), new Error('boom'));
    const data = update.mock.calls[0][0].data;
    expect(data.status).toBe('pending');
    expect(data.attempts).toBe(1);
    expect(data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('on failure reaching MAX_ATTEMPTS, lands in failed with no retry', async () => {
    const { svc, update } = makeService();
    await svc.fail(task({ attempts: MAX_ATTEMPTS - 1 }), new Error('still down'));
    const data = update.mock.calls[0][0].data;
    expect(data.status).toBe('failed');
    expect(data.nextAttemptAt).toBeNull();
  });

  it('enqueueRebuild coalesces by component (upsert with a no-op update)', async () => {
    const { svc, upsert } = makeService();
    await svc.enqueueRebuild('u', 'comp-1');
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ dedupeKey: 'tree:comp-1' });
    expect(arg.create).toMatchObject({ kind: 'rebuild_component', dedupeKey: 'tree:comp-1' });
    expect(arg.update).toEqual({});
  });

  it('claimForUser queries only that user’s due pending tasks in FIFO order', async () => {
    const { svc, findMany } = makeService();
    await svc.claimForUser('u');
    const arg = findMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({ userId: 'u', status: 'pending' });
    expect(arg.orderBy).toEqual({ createdAt: 'asc' });
  });
});

describe('enqueueMemoryTask', () => {
  it('inserts a per-memory task on the given transaction client', async () => {
    const create = jest.fn().mockResolvedValue({});
    const tx = { engineTask: { create } } as unknown as Prisma.TransactionClient;
    await enqueueMemoryTask(tx, 'u', 'mem-1', 'memory_upserted');
    expect(create).toHaveBeenCalledWith({ data: { userId: 'u', kind: 'memory_upserted', payload: { memoryId: 'mem-1' } } });
  });
});
