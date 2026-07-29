import { MemoryMutationService } from './memory-mutation.service';
import type { PrismaService } from '../../common/clients/prisma.service';
import type { VectorStorePort } from '../../common/ports/vector-store.port';
import type { WriteKernelPolicy } from './write-kernel.policy';

function mockPrisma() {
  const memoryAreaCreateMany = jest.fn().mockResolvedValue({ count: 0 });
  const outboxEventCreate = jest.fn().mockResolvedValue({});
  const tx = {
    memoryArea: { createMany: memoryAreaCreateMany },
    outboxEvent: { create: outboxEventCreate },
    space: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
  };
  const prisma = {
    space: { findUnique: jest.fn().mockResolvedValue({ ownerUserId: 'alice' }) },
    memoryIndex: {
      // Every id passed in is "owned" — the happy path for the ownership gate.
      findMany: jest.fn((args: { where: { memoryId: { in: string[] } } }) =>
        Promise.resolve(args.where.memoryId.in.map((memoryId) => ({ memoryId }))),
      ),
    },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService;
  return { prisma, memoryAreaCreateMany, outboxEventCreate };
}

const allowAll = { decide: () => ({ allowed: true }) } as unknown as WriteKernelPolicy;

describe('MemoryMutationService.seedMembership', () => {
  it('fetches current membership for all members in a single retrieve() call, not one per member', async () => {
    const retrieve = jest.fn().mockResolvedValue([
      { id: 'm1', payload: { savia_area_ids: ['x'] } },
      { id: 'm2', payload: { savia_area_ids: ['y'] } },
    ]);
    const vectors = { retrieve } as unknown as VectorStorePort;
    const { prisma, outboxEventCreate } = mockPrisma();
    const svc = new MemoryMutationService(prisma, allowAll, vectors);

    await svc.seedMembership('space1', 'alice', ['m1', 'm2']);

    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(retrieve).toHaveBeenCalledWith(['m1', 'm2'], expect.anything());
    expect(outboxEventCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ memoryId: 'm1', payload: { savia_area_ids: ['x', 'space1'] } }),
      }),
    );
    expect(outboxEventCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ memoryId: 'm2', payload: { savia_area_ids: ['y', 'space1'] } }),
      }),
    );
  });

  it('a Qdrant failure does not abort the seed — falls back to empty prior membership instead of rolling back', async () => {
    const retrieve = jest.fn().mockRejectedValue(new Error('qdrant down'));
    const vectors = { retrieve } as unknown as VectorStorePort;
    const { prisma, memoryAreaCreateMany, outboxEventCreate } = mockPrisma();
    const svc = new MemoryMutationService(prisma, allowAll, vectors);

    await svc.seedMembership('space1', 'alice', ['m1']);

    expect(memoryAreaCreateMany).toHaveBeenCalled(); // the Postgres batch still committed
    expect(outboxEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ memoryId: 'm1', payload: { savia_area_ids: ['space1'] } }),
      }),
    );
  });

  it('throws all-or-nothing if any memoryId does not belong to authorUserId', async () => {
    const vectors = { retrieve: jest.fn() } as unknown as VectorStorePort;
    const { prisma } = mockPrisma();
    (prisma.memoryIndex.findMany as jest.Mock).mockResolvedValue([{ memoryId: 'm1' }]); // m2 missing → not owned
    const svc = new MemoryMutationService(prisma, allowAll, vectors);

    await expect(
      svc.seedMembership('space1', 'alice', ['m1', 'm2']),
    ).rejects.toThrow('cross ownership scope');
    expect(vectors.retrieve).not.toHaveBeenCalled();
  });
});
