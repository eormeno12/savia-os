import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/clients/prisma.service';
import { CompiledFragment } from './scope-predicate.provider';

/**
 * The I/O half of group access (0A F1, separated from the pure compiler): given a
 * group, resolve its shared fragments to flat data the compiler can OR. Membership
 * checks live here too. (Groups arrive in FASE-5; this is forward-ready.)
 */
@Injectable()
export class GroupScopeResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** Is `userId` a member of `groupId`? (default-deny upstream of this). */
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const m = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    return m !== null;
  }

  /** The group's shared fragments, flattened for the access-filter compiler. A
   *  fragment only counts while its owner is STILL a member: a stale FragmentShare
   *  (e.g. one inserted in a race with an expel — FragmentShare has no FK to
   *  GroupMember, so the orphan can outlive the membership) must never keep feeding
   *  the group view. Enforced at read time so the read side never trusts cleanup to
   *  be race-free. */
  async resolveFragments(groupId: string): Promise<CompiledFragment[]> {
    const [fragments, members] = await Promise.all([
      this.prisma.fragmentShare.findMany({ where: { groupId } }),
      this.prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } }),
    ]);
    const memberIds = new Set(members.map((m) => m.userId));
    return fragments
      .filter((f) => memberIds.has(f.userId))
      .map((f) => ({ areaId: f.spaceId, ownerUserId: f.userId, includeSensitive: f.includeSensitive }));
  }
}
