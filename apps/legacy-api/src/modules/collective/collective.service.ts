import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CollectiveGroup, FragmentShare, GroupRole } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { EmbeddingsPort } from '../../common/ports/embeddings.port';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { P } from '../../common/ports/predicate';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../common/errors/domain-error';
import { TokenService } from '../connections/token.service';
import { AreasService } from '../areas/areas.service';
import { facetsOf, textOf } from '../../common/adapters/facets';
import type {
  AreaDto,
  ConfirmMatchDto,
  CreateGroupDto,
  FragmentDto,
  GroupDto,
  GroupMemberDto,
  InviteDto,
  MemoryResult,
  PendingInviteDto,
  ShareFragmentDto,
} from '@savia-os/contracts';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MATCH_PREVIEW_LIMIT = 20;

/**
 * Federation management: groups, members, roles, invites, fragments. The data
 * never leaves its author — sharing exposes a fragment (an area); leaving
 * removes the fragment, the memories stay with their owner.
 */
@Injectable()
export class CollectiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly embeddings: EmbeddingsPort,
    private readonly vectors: VectorStorePort,
    private readonly areas: AreasService,
  ) {}

  async create(userId: string, dto: CreateGroupDto): Promise<GroupDto> {
    const group = await this.prisma.collectiveGroup.create({
      data: { name: dto.name, members: { create: { userId, role: 'admin' } } },
    });
    return this.toGroupDto(group, 'admin', 1, 0);
  }

  async list(userId: string): Promise<GroupDto[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      include: { group: { include: { _count: { select: { members: true, fragments: true } } } } },
    });
    return memberships.map((m) =>
      this.toGroupDto(m.group, m.role, m.group._count.members, m.group._count.fragments),
    );
  }

  async get(userId: string, groupId: string): Promise<GroupDto> {
    const member = await this.requireMember(groupId, userId);
    const group = await this.prisma.collectiveGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: { _count: { select: { members: true, fragments: true } } },
    });
    return this.toGroupDto(group, member.role, group._count.members, group._count.fragments);
  }

  // ── fragments ──────────────────────────────────────────────────────────────

  async addFragment(userId: string, groupId: string, dto: ShareFragmentDto): Promise<FragmentDto> {
    await this.requireRole(groupId, userId, ['contributor', 'admin']);
    const space = await this.prisma.space.findFirst({ where: { id: dto.areaId, ownerUserId: userId } });
    if (!space) throw new NotFoundError('Área no encontrada');

    let fragment: FragmentShare;
    try {
      fragment = await this.prisma.fragmentShare.create({
        data: { groupId, userId, spaceId: dto.areaId, includeSensitive: dto.includeSensitive },
      });
    } catch (err) {
      // P2002: el UNIQUE (groupId+userId+spaceId) ya cubre este fragmento — un
      // duplicado dejaría `removeFragment` (por id) borrando solo UNA copia,
      // mientras la otra (quizás con includeSensitive distinto) sigue activa.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Ya compartiste esta área con este grupo');
      }
      throw err;
    }
    // No cache invalidation needed: `GroupScopeResolver.resolveFragments` (via
    // `AccessService.buildConnectionReadPlan`/`buildGroupReadPlan`) re-reads
    // FragmentShare fresh from Postgres on every call — the new fragment is live
    // for the very next read.
    return this.toFragmentDto(fragment);
  }

  async listFragments(userId: string, groupId: string): Promise<FragmentDto[]> {
    await this.requireMember(groupId, userId);
    const fragments = await this.prisma.fragmentShare.findMany({ where: { groupId } });
    return fragments.map((f) => this.toFragmentDto(f));
  }

  async removeFragment(userId: string, groupId: string, fragmentId: string): Promise<void> {
    await this.prisma.fragmentShare.deleteMany({ where: { id: fragmentId, groupId, userId } });
    // Same reasoning as addFragment: fragments are always read fresh, nothing to invalidate.
  }

  /**
   * "Compartir mi parte similar": rank the viewer's OWN memory against a
   * fragment another member shared, so they can pick what (if anything) is
   * theirs to contribute. Never reads the fragment owner's content — only the
   * fragment's Space description seeds the search (re-embedded fresh at full
   * 1536d, NOT the Space's 256d centroid — that dimension never matches the
   * Qdrant collection, see Lens's existing bug for why that's wrong).
   */
  async previewMatch(userId: string, groupId: string, fragmentId: string, limit = MATCH_PREVIEW_LIMIT): Promise<MemoryResult[]> {
    await this.requireMember(groupId, userId);
    const fragment = await this.prisma.fragmentShare.findFirst({
      where: { id: fragmentId, groupId },
      include: { space: true },
    });
    if (!fragment) throw new NotFoundError('Fragmento no encontrado');

    const [seed] = await this.embeddings.embed([fragment.space.description]).catch(() => [[]]);
    if (!seed?.length) return [];
    const hits = await this.vectors.knn(seed, P.own(userId), limit);
    return hits.map((h) => {
      const facets = facetsOf(h.payload);
      return {
        id: h.id,
        text: textOf(h.payload),
        score: h.score ?? 0,
        areaIds: facets.areaIds ?? [],
        sensitivity: facets.sensitivity ?? 'normal',
      };
    });
  }

  /**
   * Confirm a match: create the viewer's own personalized Space seeded with
   * what they picked from the preview (governance flips to 'manual' there,
   * since it's curated content — see AreasService.create). `shareBack`
   * defaults true — the point of the action is contributing back — but stays
   * overridable so a member can keep the result private.
   */
  async confirmMatch(userId: string, groupId: string, fragmentId: string, dto: ConfirmMatchDto): Promise<AreaDto> {
    await this.requireMember(groupId, userId);
    const fragment = await this.prisma.fragmentShare.findFirst({ where: { id: fragmentId, groupId } });
    if (!fragment) throw new NotFoundError('Fragmento no encontrado');

    const area = await this.areas.create(userId, { description: dto.description, memoryIds: dto.memoryIds });
    // shareBack contributes the curated area; sensitive stays private by default (R4).
    if (dto.shareBack) await this.addFragment(userId, groupId, { areaId: area.id, includeSensitive: false });
    return area;
  }

  // ── invites + members ────────────────────────────────────────────────────

  async invite(userId: string, groupId: string, dto: InviteDto): Promise<{ token: string }> {
    await this.requireRole(groupId, userId, ['admin']);
    const email = dto.email.toLowerCase();
    const rawToken = this.tokens.generate();
    // Re-inviting the same email replaces any still-pending invite rather than
    // piling up stray rows — the old token (if it leaked) stops working too.
    await this.prisma.groupInvite.deleteMany({ where: { groupId, email, acceptedAt: null } });
    const invite = await this.prisma.groupInvite.create({
      data: {
        groupId,
        email,
        role: dto.role,
        invitedByUserId: userId,
        tokenHash: await this.tokens.hash(rawToken),
        tokenLookup: this.tokens.lookup(rawToken),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      include: { group: { select: { name: true } } },
    });
    // Bandeja spec: invite also notifies via Notification(invite) — but only for an
    // email that already has an account. Notification.userId is a required FK, and an
    // invitee without one yet has nothing to attach it to: they keep discovering the
    // invite via GET /invites (by verified email) once they sign up.
    const invitee = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (invitee) {
      await this.prisma.notification.create({
        data: {
          userId: invitee.id,
          kind: 'invite',
          refId: invite.id,
          data: { groupId, groupName: invite.group.name, role: dto.role, invitedBy: userId },
        },
      });
    }
    return { token: rawToken }; // emailed in prod; returned for dev/testing
  }

  /** Bandeja: invites waiting for this user, looked up by their verified
   *  session email — never by id/token, so one user can't enumerate another's
   *  invites. Token itself is never exposed; accepting still needs the
   *  emailed link (POST /invites/:token/accept). */
  async listPendingInvites(userEmail: string): Promise<PendingInviteDto[]> {
    const invites = await this.prisma.groupInvite.findMany({
      where: { email: userEmail.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } },
      include: { group: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return invites.map((i) => ({
      id: i.id,
      groupId: i.groupId,
      groupName: i.group.name,
      role: i.role,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    }));
  }

  async acceptInvite(userId: string, userEmail: string, token: string): Promise<GroupDto> {
    const invite = await this.prisma.groupInvite.findUnique({ where: { tokenLookup: this.tokens.lookup(token) } });
    // Same defense-in-depth as connections.service.ts#resolveToken: `tokenLookup` is a
    // keyed HMAC (safe as a lookup even if leaked), but `tokenHash` (argon2) is the
    // actual proof-of-possession of the raw token — verified in case `mcpTokenHmacKey`
    // (shared with connection tokens) is ever compromised.
    if (
      !invite ||
      invite.acceptedAt ||
      invite.expiresAt < new Date() ||
      !(await this.tokens.verify(token, invite.tokenHash))
    ) {
      throw new UnauthorizedError('Invitación inválida o expirada');
    }
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenError('Esta invitación es para otro email');
    }
    // Only a genuinely NEW membership should notify admins — the upsert's `update: {}`
    // branch can no-op if userId was already a member through some other path.
    const alreadyMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: invite.groupId, userId } },
    });
    await this.prisma.$transaction([
      this.prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: invite.groupId, userId } },
        create: { groupId: invite.groupId, userId, role: invite.role },
        update: {},
      }),
      this.prisma.groupInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    ]);
    if (!alreadyMember) await this.notifyMemberJoined(invite.groupId, userId, userEmail);
    return this.get(userId, invite.groupId);
  }

  /** Notify the group's admins (never the joiner) that someone joined — best
   *  effort, fire-and-forget like every other Notification producer here. */
  private async notifyMemberJoined(groupId: string, newMemberUserId: string, newMemberEmail: string): Promise<void> {
    const [group, admins] = await Promise.all([
      this.prisma.collectiveGroup.findUnique({ where: { id: groupId }, select: { name: true } }),
      this.prisma.groupMember.findMany({
        where: { groupId, role: 'admin', userId: { not: newMemberUserId } },
        select: { userId: true },
      }),
    ]);
    if (!group || admins.length === 0) return;
    await this.prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.userId,
        kind: 'member_joined' as const,
        refId: newMemberUserId,
        data: { groupId, groupName: group.name, email: newMemberEmail },
      })),
    });
  }

  async listMembers(userId: string, groupId: string): Promise<GroupMemberDto[]> {
    await this.requireMember(groupId, userId);
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { email: true } } },
    });
    return members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }));
  }

  async updateMemberRole(userId: string, groupId: string, targetUserId: string, role: GroupRole): Promise<void> {
    await this.requireRole(groupId, userId, ['admin']);
    await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { role },
    });
    if (role !== 'admin') await this.ensureAdminOrClose(groupId); // demotion may have left the group adminless
  }

  async removeMember(userId: string, groupId: string, targetUserId: string): Promise<void> {
    await this.requireRole(groupId, userId, ['admin']);
    await this.expel(groupId, targetUserId);
  }

  async leave(userId: string, groupId: string): Promise<void> {
    await this.requireMember(groupId, userId);
    await this.expel(groupId, userId);
  }

  /**
   * Remove a member: their fragments leave with them; their memories stay theirs.
   * Their connections' access to the group cuts off INSTANTLY without any cache
   * invalidation — `AccessService.buildConnectionReadPlan`/`buildGroupReadPlan` both
   * re-check group membership and re-resolve fragments live on every call (there is
   * no cached predicate to go stale), and writes (`savia_remember`) were never scoped
   * by group grants to begin with. See `GrantsCache`: it only ever caches the
   * token→connection mapping, never grants/membership.
   */
  private async expel(groupId: string, targetUserId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.fragmentShare.deleteMany({ where: { groupId, userId: targetUserId } }),
      this.prisma.groupMember.deleteMany({ where: { groupId, userId: targetUserId } }),
    ]);
    await this.ensureAdminOrClose(groupId); // leaving/removing the sole admin must not orphan the group
  }

  /**
   * Invariant: a non-empty group always has ≥1 admin. Call after any operation
   * that could leave it adminless (leave, remove, role demotion, account delete).
   * Promotes the longest-tenured remaining member, or closes the group if it's
   * now empty. `excludeUserId` is for mid-account-delete: the leaving user's
   * GroupMember row hasn't been cascaded away yet, so it must be excluded from
   * both the admin count and the heir search.
   */
  async ensureAdminOrClose(groupId: string, excludeUserId?: string): Promise<void> {
    const notExcluded = excludeUserId ? { userId: { not: excludeUserId } } : {};
    const admins = await this.prisma.groupMember.count({ where: { groupId, role: 'admin', ...notExcluded } });
    if (admins > 0) return;
    const heir = await this.prisma.groupMember.findFirst({
      where: { groupId, ...notExcluded },
      orderBy: { joinedAt: 'asc' },
    });
    if (heir) {
      await this.prisma.groupMember.update({
        where: { groupId_userId: { groupId, userId: heir.userId } },
        data: { role: 'admin' },
      });
    } else {
      await this.prisma.collectiveGroup.delete({ where: { id: groupId } });
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async requireMember(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!member) throw new ForbiddenError('No sos miembro de este grupo');
    return member;
  }

  private async requireRole(groupId: string, userId: string, roles: GroupRole[]) {
    const member = await this.requireMember(groupId, userId);
    if (!roles.includes(member.role)) throw new ForbiddenError('Rol insuficiente');
    return member;
  }

  private toGroupDto(group: CollectiveGroup, role: GroupRole, memberCount: number, fragmentCount: number): GroupDto {
    return {
      id: group.id,
      name: group.name,
      role,
      memberCount,
      fragmentCount,
      createdAt: group.createdAt.toISOString(),
    };
  }

  private toFragmentDto(f: FragmentShare): FragmentDto {
    return {
      id: f.id,
      userId: f.userId,
      spaceId: f.spaceId,
      includeSensitive: f.includeSensitive,
      createdAt: f.createdAt.toISOString(),
    };
  }
}
