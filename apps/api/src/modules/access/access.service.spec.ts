import { AccessService } from './access.service';
import type { PrismaService } from '../../common/clients/prisma.service';
import type { GroupScopeResolver } from './group-scope.resolver';
import { evaluate, MemoryFacets } from '../../common/ports/predicate';
import { ReadPartition } from './read-plan';
import { ForbiddenError } from '../../common/errors/domain-error';

const mem = (areaIds: string[], extra: Partial<MemoryFacets> = {}): MemoryFacets => ({
  areaIds,
  userId: 'x',
  sensitivity: 'normal',
  superseded: false,
  ...extra,
});
const partitionFor = (plan: ReadPartition[], owner: string) => plan.find((p) => p.ownerUserId === owner);

interface Setup {
  connection?: unknown;
  isMember?: boolean;
  fragments?: unknown[];
}
const makeService = (opts: Setup) => {
  const prisma = {
    connection: { findFirst: jest.fn().mockResolvedValue(opts.connection ?? null) },
  } as unknown as PrismaService;
  const groups = {
    isMember: jest.fn().mockResolvedValue(opts.isMember ?? true),
    resolveFragments: jest.fn().mockResolvedValue(opts.fragments ?? []),
  } as unknown as GroupScopeResolver;
  return { svc: new AccessService(prisma, groups), prisma, groups };
};

describe('AccessService.buildConnectionReadPlan', () => {
  it('default-deny: a missing/revoked connection reads nothing', async () => {
    const { svc } = makeService({ connection: null });
    expect(await svc.buildConnectionReadPlan('c')).toEqual([]);
  });

  it('a space grant → one partition owned by the connection user', async () => {
    const { svc } = makeService({
      connection: { userId: 'reader', grants: [{ scope: 'space', spaceId: 'trabajo', includeSensitive: false }] },
    });
    const plan = await svc.buildConnectionReadPlan('c');
    expect(plan.map((p) => p.ownerUserId)).toEqual(['reader']);
    expect(evaluate(plan[0].predicate, mem(['trabajo']))).toBe(true);
    expect(evaluate(plan[0].predicate, mem(['salud']))).toBe(false);
  });

  it('a group grant fans out to every member fragment owner (the live union)', async () => {
    const { svc } = makeService({
      connection: { userId: 'reader', grants: [{ scope: 'group', groupId: 'g', includeSensitive: false }] },
      isMember: true,
      fragments: [
        { areaId: 'a', ownerUserId: 'alice', includeSensitive: false },
        { areaId: 'b', ownerUserId: 'bob', includeSensitive: false },
      ],
    });
    const plan = await svc.buildConnectionReadPlan('c');
    expect(plan.map((p) => p.ownerUserId).sort()).toEqual(['alice', 'bob']);
    expect(evaluate(partitionFor(plan, 'alice')!.predicate, mem(['a'], { userId: 'alice' }))).toBe(true);
    // author pin: alice's slot never surfaces bob's memory
    expect(evaluate(partitionFor(plan, 'alice')!.predicate, mem(['a'], { userId: 'bob' }))).toBe(false);
  });

  it('a group grant is dropped when the connection user is no longer a member', async () => {
    const { svc } = makeService({
      connection: { userId: 'reader', grants: [{ scope: 'group', groupId: 'g', includeSensitive: false }] },
      isMember: false,
    });
    expect(await svc.buildConnectionReadPlan('c')).toEqual([]);
  });
});

describe('AccessService.buildGroupReadPlan', () => {
  it('default-deny: a non-member is forbidden', async () => {
    const { svc } = makeService({ isMember: false });
    await expect(svc.buildGroupReadPlan('g', 'viewer')).rejects.toThrow(ForbiddenError);
  });

  it('a member gets a per-owner plan honouring the fragment owner sensitivity opt-in (R4)', async () => {
    const { svc } = makeService({
      isMember: true,
      fragments: [{ areaId: 'a', ownerUserId: 'alice', includeSensitive: true }],
    });
    const plan = await svc.buildGroupReadPlan('g', 'viewer');
    expect(plan.map((p) => p.ownerUserId)).toEqual(['alice']);
    // owner opted the fragment in → their sensitive flows into the view
    expect(evaluate(plan[0].predicate, mem(['a'], { userId: 'alice', sensitivity: 'sensitive' }))).toBe(true);
  });
});
