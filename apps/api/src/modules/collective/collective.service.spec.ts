import { Prisma } from '@prisma/client';
import { CollectiveService } from './collective.service';
import type { PrismaService } from '../../common/clients/prisma.service';
import type { TokenService } from '../connections/token.service';
import type { EmbeddingsPort } from '../../common/ports/embeddings.port';
import type { VectorStorePort } from '../../common/ports/vector-store.port';
import type { AreasService } from '../areas/areas.service';

function mockTokens(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    generate: jest.fn().mockReturnValue('savia_raw'),
    hash: jest.fn().mockResolvedValue('hashed'),
    lookup: jest.fn().mockReturnValue('lookup-key'),
    verify: jest.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as TokenService;
}

function service(prisma: Partial<PrismaService>, tokens: TokenService = mockTokens()) {
  return new CollectiveService(
    prisma as PrismaService,
    tokens,
    {} as EmbeddingsPort,
    {} as VectorStorePort,
    {} as AreasService,
  );
}

describe('CollectiveService.invite', () => {
  function basePrisma(overrides: Partial<Record<string, unknown>> = {}) {
    const groupMemberFindUnique = jest.fn().mockResolvedValue({ groupId: 'g1', userId: 'admin-1', role: 'admin' });
    const groupInviteDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const groupInviteCreate = jest
      .fn()
      .mockResolvedValue({ id: 'invite-1', group: { name: 'Familia' } });
    const notificationCreate = jest.fn().mockResolvedValue({});
    const userFindUnique = jest.fn().mockResolvedValue(null);
    return {
      groupMember: { findUnique: groupMemberFindUnique },
      groupInvite: { deleteMany: groupInviteDeleteMany, create: groupInviteCreate },
      notification: { create: notificationCreate },
      user: { findUnique: userFindUnique },
      ...overrides,
    } as unknown as PrismaService;
  }

  it('notifies the invitee via Notification(invite) when the email already has an account', async () => {
    const prisma = basePrisma();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-user' });

    await service(prisma).invite('admin-1', 'g1', { email: 'bob@savia.app', role: 'contributor' });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'existing-user',
        kind: 'invite',
        refId: 'invite-1',
        data: { groupId: 'g1', groupName: 'Familia', role: 'contributor', invitedBy: 'admin-1' },
      },
    });
  });

  it('does not notify when the invitee has no account yet (Notification.userId is a required FK)', async () => {
    const prisma = basePrisma();
    await service(prisma).invite('admin-1', 'g1', { email: 'nobody@savia.app', role: 'contributor' });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});

describe('CollectiveService.acceptInvite → member_joined', () => {
  function basePrisma(overrides: Partial<Record<string, unknown>> = {}) {
    const groupInviteFindUnique = jest.fn().mockResolvedValue({
      id: 'invite-1',
      groupId: 'g1',
      email: 'new@savia.app',
      role: 'contributor',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      tokenHash: 'stored-hash',
    });
    const groupMemberFindUnique = jest.fn().mockResolvedValue(null); // not a member yet
    const transaction = jest.fn().mockResolvedValue([{}, {}]);
    const collectiveGroupFindUnique = jest.fn().mockResolvedValue({ name: 'Familia' });
    const groupMemberFindMany = jest.fn().mockResolvedValue([{ userId: 'admin-1' }, { userId: 'admin-2' }]);
    const notificationCreateMany = jest.fn().mockResolvedValue({ count: 2 });
    return {
      groupInvite: { findUnique: groupInviteFindUnique, update: jest.fn() },
      groupMember: { findUnique: groupMemberFindUnique, findMany: groupMemberFindMany, upsert: jest.fn() },
      collectiveGroup: { findUnique: collectiveGroupFindUnique },
      notification: { createMany: notificationCreateMany },
      $transaction: transaction,
      ...overrides,
    } as unknown as PrismaService;
  }

  it('notifies every admin except the joiner', async () => {
    const prisma = basePrisma();
    jest.spyOn(CollectiveService.prototype, 'get').mockResolvedValue({} as never);

    await service(prisma).acceptInvite('new-user', 'new@savia.app', 'raw-token');

    expect(prisma.groupMember.findMany).toHaveBeenCalledWith({
      where: { groupId: 'g1', role: 'admin', userId: { not: 'new-user' } },
      select: { userId: true },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'admin-1', kind: 'member_joined', refId: 'new-user', data: { groupId: 'g1', groupName: 'Familia', email: 'new@savia.app' } },
        { userId: 'admin-2', kind: 'member_joined', refId: 'new-user', data: { groupId: 'g1', groupName: 'Familia', email: 'new@savia.app' } },
      ],
    });
    jest.restoreAllMocks();
  });

  it('does not notify when the user was already a member (idempotent re-accept)', async () => {
    const prisma = basePrisma({ groupMember: { findUnique: jest.fn().mockResolvedValue({ groupId: 'g1', userId: 'new-user' }), findMany: jest.fn(), upsert: jest.fn() } });
    jest.spyOn(CollectiveService.prototype, 'get').mockResolvedValue({} as never);

    await service(prisma).acceptInvite('new-user', 'new@savia.app', 'raw-token');

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('skips notifying entirely when the group has no other admins', async () => {
    const prisma = basePrisma({ groupMember: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() } });
    jest.spyOn(CollectiveService.prototype, 'get').mockResolvedValue({} as never);

    await service(prisma).acceptInvite('new-user', 'new@savia.app', 'raw-token');

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  // Regression: `tokenLookup` alone (a keyed HMAC) was treated as sufficient proof of
  // possession — unlike connections.service.ts#resolveToken, which ALSO verifies the
  // raw token against the argon2 `tokenHash`. Since both flows share the same
  // `mcpTokenHmacKey`, a lookup match with no hash verification meant a compromised
  // HMAC key alone (without the actual random invite token) could accept an invite.
  it('rejects when the raw token does not verify against tokenHash, even though tokenLookup matched', async () => {
    const prisma = basePrisma();
    const tokens = mockTokens({ verify: jest.fn().mockResolvedValue(false) });

    await expect(service(prisma, tokens).acceptInvite('new-user', 'new@savia.app', 'wrong-token')).rejects.toThrow(
      'Invitación inválida o expirada',
    );
    expect(tokens.verify).toHaveBeenCalledWith('wrong-token', 'stored-hash');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('CollectiveService.addFragment', () => {
  function basePrisma(overrides: Partial<Record<string, unknown>> = {}) {
    const groupMemberFindUnique = jest.fn().mockResolvedValue({ groupId: 'g1', userId: 'alice', role: 'contributor' });
    const spaceFindFirst = jest.fn().mockResolvedValue({ id: 'area-1', ownerUserId: 'alice' });
    return {
      groupMember: { findUnique: groupMemberFindUnique },
      space: { findFirst: spaceFindFirst },
      ...overrides,
    } as unknown as PrismaService;
  }

  // Regression: FragmentShare had no uniqueness guard on (groupId, userId, spaceId).
  // Sharing the same area twice created two rows; `removeFragment` deletes by id, so
  // one leftover copy — possibly with a DIFFERENT includeSensitive — kept the area
  // (and potentially the owner's sensitive memories) live in the group view even
  // after the user believed they'd unshared or corrected it. Now the DB constraint
  // rejects the duplicate outright via P2002 → ConflictError.
  it('rejects re-sharing the same area to the same group (P2002 → ConflictError)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    const prisma = basePrisma({
      fragmentShare: { create: jest.fn().mockRejectedValue(p2002) },
    });

    await expect(service(prisma).addFragment('alice', 'g1', { areaId: 'area-1', includeSensitive: false })).rejects.toThrow(
      'Ya compartiste esta área con este grupo',
    );
  });

  it('propagates unrelated errors instead of masking them as a conflict', async () => {
    const prisma = basePrisma({
      fragmentShare: { create: jest.fn().mockRejectedValue(new Error('db down')) },
    });

    await expect(service(prisma).addFragment('alice', 'g1', { areaId: 'area-1', includeSensitive: false })).rejects.toThrow(
      'db down',
    );
  });
});
