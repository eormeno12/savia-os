import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Connection, Grant } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { ConflictError, ForbiddenError } from '../../common/errors/domain-error';
import { AccessService } from '../access/access.service';
import { TokenService } from './token.service';
import { GrantsCache, ResolvedConnection } from './grants.cache';
import type {
  ConnectionDto,
  CreateConnectionDto,
  CreateConnectionResponse,
  CreateGrantDto,
  GrantDto,
} from '@savia-os/legacy-contracts';

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly cache: GrantsCache,
    private readonly access: AccessService,
  ) {}

  async create(userId: string, dto: CreateConnectionDto): Promise<CreateConnectionResponse> {
    const rawToken = this.tokens.generate();
    const [tokenHash, tokenLookup] = [await this.tokens.hash(rawToken), this.tokens.lookup(rawToken)];
    const conn = await this.prisma.connection.create({
      data: { userId, label: dto.label, tokenHash, tokenLookup },
    });
    return { ...this.toDto(conn, []), token: rawToken };
  }

  async findAll(userId: string): Promise<ConnectionDto[]> {
    const conns = await this.prisma.connection.findMany({
      where: { userId },
      include: { grants: true },
      orderBy: { createdAt: 'desc' },
    });
    return conns.map((c) => this.toDto(c, c.grants));
  }

  async revoke(userId: string, connectionId: string): Promise<void> {
    const conn = await this.access.assertOwnsConnection(userId, connectionId);
    await this.prisma.connection.update({ where: { id: connectionId }, data: { revokedAt: new Date() } });
    // Strict: the DB write above is already durable (resolveToken's DB fallback
    // will reject the token immediately), but a stale cache entry could still
    // serve it for up to TTL_SECONDS. Do NOT swallow a failure here — let it
    // propagate (5xx) so the caller knows the revoke isn't fully confirmed and
    // retries (idempotent: the DB update and the cache invalidate both no-op
    // safely on retry).
    await this.cache.invalidate(conn.tokenLookup);
    this.logger.log(`revoked connection id=${connectionId}`);
  }

  async addGrant(userId: string, connectionId: string, dto: CreateGrantDto): Promise<GrantDto> {
    const conn = await this.access.assertOwnsConnection(userId, connectionId);
    if (conn.revokedAt) throw new ConflictError('Conexión revocada');

    // The grantor must own/belong to the target.
    if (dto.scope === 'space') {
      await this.access.assertCanManageSpace(userId, dto.spaceId!);
    } else {
      const member = await this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: dto.groupId!, userId } },
      });
      if (!member) throw new ForbiddenError('No sos miembro de ese grupo');
    }

    let grant: Grant;
    try {
      grant = await this.prisma.grant.create({
        data: {
          connectionId,
          scope: dto.scope,
          spaceId: dto.spaceId ?? null,
          groupId: dto.groupId ?? null,
          includeSensitive: dto.includeSensitive,
        },
      });
    } catch (err) {
      // P2002: el UNIQUE parcial (connectionId + target) ya cubre este grant.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Ya existe un grant para ese destino en esta conexión');
      }
      throw err;
    }
    // No cache invalidation needed: `GrantsCache` only ever holds the token→connection
    // identity mapping, never grants. `AccessService.buildConnectionReadPlan` re-fetches
    // `connection.grants` fresh from Postgres on every call, so a new grant is visible
    // to the very next read regardless of cache state.
    return this.grantDto(grant);
  }

  async removeGrant(userId: string, connectionId: string, grantId: string): Promise<void> {
    await this.access.assertOwnsConnection(userId, connectionId);
    await this.prisma.grant.deleteMany({ where: { id: grantId, connectionId } });
    // Same reasoning as addGrant: grants are always read fresh, nothing to invalidate.
  }

  /**
   * Hot path: raw token → connection. O(1) HMAC lookup + ONE argon2 verify
   * (defense in depth), cached for 60s under the same key the writers invalidate.
   */
  async resolveToken(rawToken: string): Promise<ResolvedConnection> {
    const tokenLookup = this.tokens.lookup(rawToken);
    const cached = await this.cache.get(tokenLookup);
    if (cached) return cached;

    const conn = await this.prisma.connection.findFirst({ where: { tokenLookup, revokedAt: null } });
    if (!conn || !(await this.tokens.verify(rawToken, conn.tokenHash))) {
      throw new ForbiddenError('Token inválido o revocado');
    }

    const resolved: ResolvedConnection = { connectionId: conn.id, userId: conn.userId, label: conn.label };
    await this.cache.set(tokenLookup, resolved);
    void this.prisma.connection
      .update({ where: { id: conn.id }, data: { lastSeenAt: new Date() } })
      .catch(() => null);
    return resolved;
  }

  /** Drop the resolution cache for ALL of a user's connections (e.g. on group
   *  expulsion) so their AI access re-derives from scratch on the next call. */
  async invalidateAllForUser(userId: string): Promise<void> {
    const conns = await this.prisma.connection.findMany({ where: { userId }, select: { tokenLookup: true } });
    await Promise.all(conns.map((c) => this.cache.invalidate(c.tokenLookup)));
  }

  private toDto(conn: Connection, grants: Grant[]): ConnectionDto {
    return {
      id: conn.id,
      label: conn.label,
      lastSeenAt: conn.lastSeenAt?.toISOString() ?? null,
      revoked: !!conn.revokedAt,
      grants: grants.map((g) => this.grantDto(g)),
      createdAt: conn.createdAt.toISOString(),
    };
  }

  private grantDto(g: Grant): GrantDto {
    return {
      id: g.id,
      scope: g.scope,
      spaceId: g.spaceId,
      groupId: g.groupId,
      includeSensitive: g.includeSensitive,
      createdAt: g.createdAt.toISOString(),
    };
  }
}
