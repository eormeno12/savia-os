import { AreasService } from './areas.service';
import type { PrismaService } from '../../common/clients/prisma.service';

function mockPrisma(parentById: Record<string, string | null>) {
  const findUnique = jest.fn(({ where: { id } }: { where: { id: string } }) =>
    Promise.resolve(id in parentById ? { parentId: parentById[id] } : null),
  );
  return { prisma: { space: { findUnique } } as unknown as PrismaService };
}

function service(parentById: Record<string, string | null>) {
  const { prisma } = mockPrisma(parentById);
  // ancestorsOf/closure only touch `prisma` — the other collaborators are unused here.
  return new AreasService(prisma, {} as never, {} as never, {} as never, {} as never);
}

describe('AreasService.ancestorsOf', () => {
  it('walks up to the root and returns ancestors nearest-first', async () => {
    const svc = service({ leaf: 'mid', mid: 'root', root: null });
    await expect(svc.ancestorsOf('leaf')).resolves.toEqual(['mid', 'root']);
  });

  it('throws instead of silently truncating when the parent chain cycles', async () => {
    const svc = service({ a: 'b', b: 'a' });
    await expect(svc.ancestorsOf('a')).rejects.toThrow(/cycle/i);
  });
});

describe('AreasService.closure', () => {
  it('includes the area itself plus every ancestor', async () => {
    const svc = service({ leaf: 'mid', mid: 'root', root: null });
    const result = await svc.closure(['leaf']);
    expect(new Set(result)).toEqual(new Set(['leaf', 'mid', 'root']));
  });
});

function mockTreePrisma(
  names: Record<string, { name: string; isDefault?: boolean }>,
  childrenOf: Record<string, string[]>,
  pathDepth: Record<string, { path: string; depth: number }>,
) {
  const findUnique = jest.fn(({ where: { id }, select }: { where: { id: string }; select: Record<string, boolean> }) => {
    if (!(id in names)) return Promise.resolve(null);
    return Promise.resolve('path' in select ? pathDepth[id] : { name: names[id].name, isDefault: !!names[id].isDefault });
  });
  const findMany = jest.fn(({ where: { parentId } }: { where: { parentId: string } }) =>
    Promise.resolve((childrenOf[parentId] ?? []).map((id) => ({ id }))),
  );
  const update = jest.fn().mockResolvedValue({});
  const space = { findUnique, findMany, update };
  const $transaction = jest.fn((cb: (tx: { space: typeof space }) => Promise<void>) => cb({ space }));
  const prisma = { space, $transaction } as unknown as PrismaService;
  return { prisma, update };
}

function serviceWithTree(...args: Parameters<typeof mockTreePrisma>) {
  const { prisma, update } = mockTreePrisma(...args);
  return { svc: new AreasService(prisma, {} as never, {} as never, {} as never, {} as never), update };
}

describe('AreasService.reindexFrom', () => {
  it('recomputes path + depth for every descendant of parentId', async () => {
    const { svc, update } = serviceWithTree(
      { root: { name: 'Root' }, child: { name: 'Child' }, grand: { name: 'Grand' } },
      { root: ['child'], child: ['grand'] },
      { root: { path: '/root', depth: 0 } },
    );
    await svc.reindexFrom('root');
    expect(update).toHaveBeenCalledWith({ where: { id: 'child' }, data: { path: '/root/child', depth: 1 } });
    expect(update).toHaveBeenCalledWith({ where: { id: 'grand' }, data: { path: '/root/child/grand', depth: 2 } });
  });

  it('throws instead of recursing forever when the children chain cycles', async () => {
    const { svc } = serviceWithTree(
      { root: { name: 'Root' }, a: { name: 'A' }, b: { name: 'B' } },
      { root: ['a'], a: ['b'], b: ['a'] },
      { root: { path: '/root', depth: 0 } },
    );
    await expect(svc.reindexFrom('root')).rejects.toThrow(/cycle/i);
  });
});
