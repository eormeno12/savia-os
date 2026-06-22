import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/clients/prisma.service';
import { TokenService } from './token.service';
import { GrantsCache, ResolvedToken } from './grants.cache';
import type {
  CreateConnectionDto,
  ConnectionDto,
  CreateConnectionResponse,
} from '@savia-os/contracts';

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly grantsCache: GrantsCache,
  ) {}

  async create(userId: string, dto: CreateConnectionDto): Promise<CreateConnectionResponse> {
    const rawToken = this.tokenService.generate();
    const tokenHash = await this.tokenService.hash(rawToken);

    const connection = await this.prisma.connection.create({
      data: { userId, label: dto.label, tokenHash },
    });

    return {
      id: connection.id,
      label: connection.label,
      lastSeenAt: null,
      revoked: false,
      spaceIds: [],
      createdAt: connection.createdAt.toISOString(),
      token: rawToken,
    };
  }

  async findAll(userId: string): Promise<ConnectionDto[]> {
    const connections = await this.prisma.connection.findMany({
      where: { userId },
      include: { grants: { select: { spaceId: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return connections.map((c) => ({
      id: c.id,
      label: c.label,
      lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
      revoked: !!c.revokedAt,
      spaceIds: c.grants.map((g) => g.spaceId),
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async revoke(userId: string, connectionId: string): Promise<void> {
    const conn = await this.prisma.connection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!conn) throw new NotFoundException('Conexión no encontrada');

    await this.prisma.connection.update({
      where: { id: connectionId },
      data: { revokedAt: new Date() },
    });
    await this.grantsCache.invalidate(conn.tokenHash);
    this.logger.log(`revoked connection id=${connectionId}`);
  }

  async addGrant(userId: string, connectionId: string, spaceId: string): Promise<void> {
    const conn = await this.prisma.connection.findFirst({
      where: { id: connectionId, userId, revokedAt: null },
    });
    if (!conn) throw new NotFoundException('Conexión no encontrada o revocada');

    const space = await this.prisma.space.findFirst({ where: { id: spaceId, userId } });
    if (!space) throw new NotFoundException('Space no encontrado');

    await this.prisma.grant.upsert({
      where: { connectionId_spaceId: { connectionId, spaceId } },
      create: { connectionId, spaceId },
      update: {},
    });

    await this.grantsCache.invalidate(conn.tokenHash);
  }

  async removeGrant(userId: string, connectionId: string, spaceId: string): Promise<void> {
    const conn = await this.prisma.connection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!conn) throw new NotFoundException('Conexión no encontrada');

    await this.prisma.grant.delete({
      where: { connectionId_spaceId: { connectionId, spaceId } },
    }).catch(() => null);

    await this.grantsCache.invalidate(conn.tokenHash);
  }

  /**
   * Resolves a raw MCP token to its connection context.
   * Used by the MCP server (hot path). Results are cached in Redis for 60s.
   */
  async resolveToken(rawToken: string): Promise<ResolvedToken> {
    // We can't look up by hash directly since argon2 is one-way.
    // Strategy: iterate non-revoked connections and verify. Cache the result.
    // For MVP scale (few connections per user), this is fast enough.
    // Production: store a fast-lookup key (HMAC prefix) alongside the argon2 hash.

    const connections = await this.prisma.connection.findMany({
      where: { revokedAt: null },
      include: { grants: { select: { spaceId: true } } },
    });

    for (const conn of connections) {
      const match = await this.tokenService.verify(rawToken, conn.tokenHash);
      if (!match) continue;

      const resolved: ResolvedToken = {
        connectionId: conn.id,
        userId: conn.userId,
        spaceIds: conn.grants.map((g) => g.spaceId),
      };

      await this.grantsCache.set(conn.tokenHash, resolved);

      // Update lastSeenAt without blocking
      this.prisma.connection.update({
        where: { id: conn.id },
        data: { lastSeenAt: new Date() },
      }).catch(() => null);

      return resolved;
    }

    throw new ForbiddenException('Token inválido o revocado');
  }

  /**
   * Fast token resolution for the MCP server — cache first.
   */
  async resolveTokenCached(rawToken: string): Promise<ResolvedToken> {
    // Derive a stable cache key from the raw token using a lightweight hash.
    // We use a simple SHA-256 prefix (not argon2) just for cache lookup.
    const { createHash } = await import('crypto');
    const cacheKey = createHash('sha256').update(rawToken).digest('base64url').slice(0, 32);

    const cached = await this.grantsCache.get(cacheKey);
    if (cached) return cached;

    const resolved = await this.resolveToken(rawToken);
    await this.grantsCache.set(cacheKey, resolved);
    return resolved;
  }
}
