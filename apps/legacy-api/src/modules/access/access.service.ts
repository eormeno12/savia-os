import { Injectable } from '@nestjs/common';
import type { MemoryIndex, Space } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { ForbiddenError, NotFoundError } from '../../common/errors/domain-error';
import { CompiledGrant } from './scope-predicate.provider';
import { compileReadPlan, ReadPartition } from './read-plan';
import { GroupScopeResolver } from './group-scope.resolver';

/**
 * The single authority for access decisions (08 §6 / 0A F1). It ORCHESTRATES —
 * it fetches grants and resolves groups, then hands flat data to the pure
 * compiler. Every read filter and every mutation check goes through here.
 */
@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupScopeResolver,
  ) {}

  // ── Read frontier (cross-boundary: MCP connections + group federation view) ──

  /**
   * The read PLAN for an MCP connection: one owner partition per owner whose data
   * this connection may see, clamped by `requested`, default-deny. Group grants
   * fan out to every member's shared fragments (the reader gets the live union),
   * and only count while the connection's user is still a member of the group
   * (revoked membership → dropped). Sensitivity follows R4 (see {@link compileReadPlan}).
   */
  async buildConnectionReadPlan(connectionId: string, requested?: string[]): Promise<ReadPartition[]> {
    const connection = await this.prisma.connection.findFirst({
      where: { id: connectionId, revokedAt: null },
      include: { grants: true },
    });
    if (!connection) return []; // default-deny: revoked/missing connection reads nothing

    const compiled: CompiledGrant[] = [];
    for (const g of connection.grants) {
      if (g.scope === 'space' && g.spaceId) {
        compiled.push({ scope: 'space', areaId: g.spaceId, includeSensitive: g.includeSensitive });
      } else if (g.scope === 'group' && g.groupId) {
        if (!(await this.groups.isMember(g.groupId, connection.userId))) continue;
        const fragments = await this.groups.resolveFragments(g.groupId);
        // includeSensitive is ignored for group grants: sensitivity is the fragment
        // owner's opt-in (R4), governed per-fragment inside `fragmentScope`.
        compiled.push({ scope: 'group', fragments, includeSensitive: g.includeSensitive });
      }
    }
    return compileReadPlan(compiled, connection.userId, requested);
  }

  /**
   * The read PLAN for a group's federated view: fan-out over every current
   * member's shared fragments, scoped to each owner's partition. Default-deny
   * for non-members (asserted here). The single authority both the collective
   * controller and the MCP path route through — no hand-rolled predicates.
   */
  async buildGroupReadPlan(groupId: string, viewerUserId: string, requested?: string[]): Promise<ReadPartition[]> {
    if (!(await this.groups.isMember(groupId, viewerUserId))) {
      throw new ForbiddenError('No sos miembro de este grupo');
    }
    const fragments = await this.groups.resolveFragments(groupId);
    const grant: CompiledGrant = { scope: 'group', fragments, includeSensitive: false };
    return compileReadPlan([grant], viewerUserId, requested);
  }

  /** The areas a user owns — the personal read scope (used by the UI/search). */
  async readableAreaIds(userId: string): Promise<string[]> {
    const spaces = await this.prisma.space.findMany({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    return spaces.map((s) => s.id);
  }

  // ── Mutation / management asserts ──────────────────────────────────────────

  /**
   * Closes the IDOR (P0-1): only the author may mutate a memory. Federation keeps
   * data with its author, so author-only is both correct and sufficient.
   */
  async assertCanMutateMemory(userId: string, memoryId: string): Promise<MemoryIndex> {
    const memory = await this.prisma.memoryIndex.findUnique({ where: { memoryId } });
    if (!memory) throw new NotFoundError('Memoria no encontrada');
    if (memory.authorUserId !== userId) throw new ForbiddenError('No autorizado sobre esta memoria');
    return memory;
  }

  /** Only the owner manages an area. */
  async assertCanManageSpace(userId: string, spaceId: string): Promise<Space> {
    const space = await this.prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) throw new NotFoundError('Área no encontrada');
    if (space.ownerUserId !== userId) throw new ForbiddenError('No autorizado sobre esta área');
    return space;
  }

  /** Owner of the connection (for grant management). */
  async assertOwnsConnection(userId: string, connectionId: string) {
    const conn = await this.prisma.connection.findFirst({ where: { id: connectionId, userId } });
    if (!conn) throw new NotFoundError('Conexión no encontrada');
    return conn;
  }
}
