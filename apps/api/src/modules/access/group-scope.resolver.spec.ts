import { GroupScopeResolver } from './group-scope.resolver';
import type { PrismaService } from '../../common/clients/prisma.service';

// Regression: resolveFragments returned EVERY FragmentShare for the group with no
// membership check, so a stale fragment (e.g. one inserted in a race with an expel —
// FragmentShare has no FK to GroupMember) kept feeding the union view after its owner
// was gone. A fragment now only counts while its owner is still a member.
describe('GroupScopeResolver.resolveFragments — only current members feed the view', () => {
  it('drops a stale fragment whose owner is no longer a member', async () => {
    const prisma = {
      fragmentShare: {
        findMany: jest.fn().mockResolvedValue([
          { spaceId: 'A', userId: 'member' },
          { spaceId: 'B', userId: 'ghost' }, // left/expelled, but the row lingers
        ]),
      },
      groupMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'member' }]) },
    } as unknown as PrismaService;

    const frags = await new GroupScopeResolver(prisma).resolveFragments('g');

    expect(frags).toEqual([{ areaId: 'A', ownerUserId: 'member' }]);
  });
});
