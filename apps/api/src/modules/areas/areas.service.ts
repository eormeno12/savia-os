import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, Space } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { LlmPort } from '../../common/ports/llm.port';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { P } from '../../common/ports/predicate';
import { ForbiddenError } from '../../common/errors/domain-error';
import { MemoryMutationService } from '../kernel/memory-mutation.service';
import { AccessService } from '../access/access.service';
import { facetsOf, textOf } from '../../common/adapters/facets';
import type { AreaDto, AreaMemoriesPage, AreaMemoryDto, AreaTreeNode, CreateAreaDto, UpdateAreaDto } from '@savia-os/contracts';

// No fixed depth cap: the dynamic engine decides depth per branch. This is only a
// cycle-safety bound, shared by every walk of the Space tree (up via parentId in
// ancestorsOf, down via children in reindexSubtree).
const MAX_TREE_WALK = 64;

/**
 * The area tree (Space). Owns the hierarchy (parentId/path/depth — depth is
 * data-driven, not capped), the General root, CRUD, the nested tree for the map,
 * and hydrated memory listings. Counts are a live SQL count over MemoryArea (a
 * memory sits in a leaf AND its ancestors' closure → the count is the overlapping
 * subtree Venn, same semantics the old CF triple gave).
 */
@Injectable()
export class AreasService {
  private readonly logger = new Logger(AreasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmPort,
    private readonly vectors: VectorStorePort,
    private readonly kernel: MemoryMutationService,
    private readonly access: AccessService,
  ) {}

  // ── tree primitives ────────────────────────────────────────────────────────

  async ensureGeneral(userId: string): Promise<Space> {
    const existing = await this.prisma.space.findFirst({ where: { ownerUserId: userId, isDefault: true } });
    if (existing) return existing;
    return this.prisma.space.create({
      data: { ownerUserId: userId, isDefault: true, name: 'General', path: '/general', depth: 0, description: 'Tu memoria general' },
    });
  }

  /** Throws once a tree walk (either direction) has taken more than MAX_TREE_WALK
   *  steps. Should never trip on a real tree — hitting it means a cycle in
   *  Space.parentId. Callers must fail loudly rather than degrade silently:
   *  a truncated ancestorsOf() breaks closure()'s grants, and unbounded
   *  reindexSubtree() recursion would hang the request instead of erroring. */
  private assertTreeWalkBounded(context: string, steps: number): void {
    if (steps >= MAX_TREE_WALK) {
      throw new Error(`${context}: exceeded ${MAX_TREE_WALK} levels — likely a cycle in Space.parentId`);
    }
  }

  async ancestorsOf(spaceId: string): Promise<string[]> {
    const out: string[] = [];
    let current = await this.prisma.space.findUnique({ where: { id: spaceId }, select: { parentId: true } });
    let guard = 0;
    while (current?.parentId) {
      this.assertTreeWalkBounded(`ancestorsOf(${spaceId})`, guard++);
      out.push(current.parentId);
      current = await this.prisma.space.findUnique({ where: { id: current.parentId }, select: { parentId: true } });
    }
    return out;
  }

  async closure(areaIds: string[]): Promise<string[]> {
    const set = new Set<string>();
    for (const id of areaIds) {
      set.add(id);
      for (const a of await this.ancestorsOf(id)) set.add(a);
    }
    return [...set];
  }

  /** Recompute path + depth for a node and ALL its descendants from its parent.
   *  Keeps the materialized path/depth correct after a rename or a re-parent. */
  private async reindexSubtree(
    tx: Prisma.TransactionClient,
    spaceId: string,
    parentPath: string,
    parentDepth: number,
    steps = 0,
  ): Promise<void> {
    this.assertTreeWalkBounded(`reindexSubtree(${spaceId})`, steps);
    const node = await tx.space.findUnique({ where: { id: spaceId }, select: { name: true, isDefault: true } });
    if (!node) return;
    const path = node.isDefault ? '/general' : `${parentPath}/${slug(node.name)}`.slice(0, 512);
    const depth = node.isDefault ? 0 : parentDepth + 1;
    await tx.space.update({ where: { id: spaceId }, data: { path, depth } });
    const children = await tx.space.findMany({ where: { parentId: spaceId }, select: { id: true } });
    for (const c of children) await this.reindexSubtree(tx, c.id, path, depth, steps + 1);
  }

  /** Reindex every child subtree of `parentId` (after re-parenting into it). */
  async reindexFrom(parentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const parent = await tx.space.findUnique({ where: { id: parentId }, select: { path: true, depth: true } });
      if (!parent) return;
      const children = await tx.space.findMany({ where: { parentId }, select: { id: true } });
      for (const c of children) await this.reindexSubtree(tx, c.id, parent.path, parent.depth);
    });
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateAreaDto): Promise<AreaDto> {
    const parent = dto.parentId
      ? await this.access.assertCanManageSpace(userId, dto.parentId)
      : await this.ensureGeneral(userId);

    const name = await this.deriveName(dto.description);
    const path = await this.uniquePath(userId, `${parent.path}/${slug(name)}`);
    const hasSeed = !!dto.memoryIds?.length;

    const space = await this.prisma.space.create({
      data: {
        ownerUserId: userId,
        parentId: parent.id,
        depth: parent.depth + 1,
        name,
        description: dto.description,
        path,
        // Confirming specific existing content is itself a curation act (more
        // deliberate than just naming) → pin governance; an empty/blank area
        // stays 'auto', same as today, since nothing was actually curated yet.
        governance: hasSeed ? 'manual' : 'auto',
      },
    });

    if (hasSeed) await this.kernel.seedMembership(space.id, userId, dto.memoryIds!);
    return this.toDto(space, await this.countFor(space.id));
  }

  async update(userId: string, id: string, dto: UpdateAreaDto): Promise<AreaDto> {
    const space = await this.access.assertCanManageSpace(userId, id);
    const data: Prisma.SpaceUpdateInput = { governance: 'manual' }; // user edit pins the area
    if (dto.name) data.name = dto.name;
    if (dto.description) data.description = dto.description;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.space.update({ where: { id: space.id }, data });
      if (dto.name) {
        // rename changes this node's slug → re-path it and its descendants.
        const parent = space.parentId
          ? await tx.space.findUnique({ where: { id: space.parentId }, select: { path: true, depth: true } })
          : null;
        await this.reindexSubtree(tx, space.id, parent?.path ?? '', parent?.depth ?? -1);
      }
      return tx.space.findUniqueOrThrow({ where: { id: space.id } });
    });
    return this.toDto(updated, await this.countFor(space.id));
  }

  /** Delete an area: re-home its memories + children to the parent, then drop it. */
  async remove(userId: string, id: string): Promise<void> {
    const space = await this.access.assertCanManageSpace(userId, id);
    if (space.isDefault) throw new ForbiddenError('No se puede borrar el área General');
    const parentId = space.parentId ?? (await this.ensureGeneral(userId)).id;
    const parentClosure = await this.closure([parentId]);

    await this.prisma.$transaction(async (tx) => {
      // Re-parent children up one level.
      await tx.space.updateMany({ where: { parentId: id }, data: { parentId } });
      // Regla unificada de delete: quitar esta área de la membership de toda memoria
      // y, si queda vacía, hacer backfill con la closure del padre. MemoryArea.spaceId
      // es Restrict, así que esto DEBE ir antes del space.delete (no quedan filas huérfanas).
      const affected = await tx.memoryArea.findMany({ where: { spaceId: id }, select: { memoryId: true } });
      await tx.memoryArea.deleteMany({ where: { spaceId: id } });
      for (const { memoryId } of affected) {
        await tx.memoryArea.createMany({
          data: parentClosure.map((sid) => ({ memoryId, spaceId: sid })),
          skipDuplicates: true,
        });
      }
      // File.spaceId es ahora Restrict (no Cascade): re-homear los archivos al
      // padre antes del delete — mismo motivo que MemoryArea arriba. Sin closure
      // (a diferencia de MemoryArea): un File vive en un único área, no hay
      // multi-membership para archivos.
      await tx.file.updateMany({ where: { spaceId: id }, data: { spaceId: parentId } });
      // Grant/FragmentShare: re-home to the parent so a grant/fragment scoped to
      // this area keeps seeing its content once it moves — both are onDelete:Cascade,
      // so leaving this out silently revokes AI/group access to content that still
      // exists. Grant has a (connectionId, spaceId) unique index: when the same
      // connection already has a grant on the parent, reconcile to the more
      // permissive includeSensitive (never silently narrow access) before dropping
      // the now-redundant duplicate on the doomed area.
      const [childGrants, parentGrants] = await Promise.all([
        tx.grant.findMany({ where: { spaceId: id } }),
        tx.grant.findMany({ where: { spaceId: parentId } }),
      ]);
      const parentGrantByConn = new Map(parentGrants.map((g) => [g.connectionId, g]));
      const collidingConns: string[] = [];
      for (const cg of childGrants) {
        const pg = parentGrantByConn.get(cg.connectionId);
        if (!pg) continue;
        collidingConns.push(cg.connectionId);
        if (cg.includeSensitive && !pg.includeSensitive) {
          await tx.grant.update({ where: { id: pg.id }, data: { includeSensitive: true } });
        }
      }
      if (collidingConns.length) {
        await tx.grant.deleteMany({ where: { spaceId: id, connectionId: { in: collidingConns } } });
      }
      await tx.grant.updateMany({ where: { spaceId: id }, data: { spaceId: parentId } });
      await tx.fragmentShare.updateMany({ where: { spaceId: id }, data: { spaceId: parentId } });
      await tx.space.delete({ where: { id } });
      // Recompute path/depth of everything now hanging off the new parent.
      const np = await tx.space.findUnique({ where: { id: parentId }, select: { path: true, depth: true } });
      if (np) {
        const kids = await tx.space.findMany({ where: { parentId }, select: { id: true } });
        for (const k of kids) await this.reindexSubtree(tx, k.id, np.path, np.depth);
      }
    });

    // Best-effort: rewrite area_ids of affected points (drop the deleted area, add parent closure).
    await this.rewriteMembershipAfterDelete(userId, id, parentClosure).catch((err) =>
      this.logger.warn(`membership rewrite after delete failed: ${(err as Error).message}`),
    );
  }

  private async rewriteMembershipAfterDelete(userId: string, deletedId: string, parentClosure: string[]): Promise<void> {
    // includeSuperseded: the membership rewrite must touch superseded points too.
    const page = await this.vectors.scroll(P.own(userId, { areaIds: [deletedId], includeSuperseded: true }), { limit: 1000 });
    for (const point of page.points) {
      const current = facetsOf(point.payload).areaIds ?? [];
      const next = [...new Set([...current.filter((a) => a !== deletedId), ...parentClosure])];
      await this.prisma.outboxEvent.create({
        data: { kind: 'set_payload', memoryId: point.id, payload: { savia_area_ids: next } },
      });
    }
  }

  /** Create a child area without LLM naming (the engine names it afterwards). */
  async createChild(ownerUserId: string, parent: Space, name: string): Promise<Space> {
    const path = await this.uniquePath(ownerUserId, `${parent.path}/${slug(name)}`);
    return this.prisma.space.create({
      data: { ownerUserId, parentId: parent.id, depth: parent.depth + 1, name, description: '', path, governance: 'auto' },
    });
  }

  /** A path unique within the user's tree (disambiguates same-name siblings). */
  private async uniquePath(userId: string, basePath: string): Promise<string> {
    const base = basePath.slice(0, 480);
    const free = async (p: string) =>
      (await this.prisma.space.findFirst({ where: { ownerUserId: userId, path: p }, select: { id: true } })) === null;
    if (await free(base)) return base;
    for (let i = 2; i < 100; i++) {
      const candidate = `${base}-${i}`;
      if (await free(candidate)) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  // ── reads ──────────────────────────────────────────────────────────────────

  /** Live overlapping-subtree count per area (Venn): a memory has a MemoryArea row
   *  for its leaf AND every ancestor, so counting rows per space gives the same
   *  semantics the old cfCount did. Superseded memories are excluded. */
  private async countsFor(userId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.memoryArea.groupBy({
      by: ['spaceId'],
      where: { space: { ownerUserId: userId }, memory: { supersededBy: null } },
      _count: { memoryId: true },
    });
    return new Map(rows.map((r) => [r.spaceId, r._count.memoryId]));
  }

  private async countFor(spaceId: string): Promise<number> {
    return this.prisma.memoryArea.count({ where: { spaceId, memory: { supersededBy: null } } });
  }

  async list(userId: string): Promise<AreaDto[]> {
    const [spaces, counts] = await Promise.all([
      this.prisma.space.findMany({ where: { ownerUserId: userId }, orderBy: { path: 'asc' } }),
      this.countsFor(userId),
    ]);
    return spaces.map((s) => this.toDto(s, counts.get(s.id) ?? 0));
  }

  async tree(userId: string): Promise<AreaTreeNode[]> {
    const [spaces, counts] = await Promise.all([
      this.prisma.space.findMany({ where: { ownerUserId: userId }, orderBy: { path: 'asc' } }),
      this.countsFor(userId),
    ]);
    const byParent = new Map<string | null, typeof spaces>();
    for (const s of spaces) {
      const arr = byParent.get(s.parentId) ?? [];
      arr.push(s);
      byParent.set(s.parentId, arr);
    }
    const build = (parentId: string | null): AreaTreeNode[] =>
      (byParent.get(parentId) ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        depth: s.depth,
        isDefault: s.isDefault,
        memoryCount: counts.get(s.id) ?? 0,
        children: build(s.id),
      }));
    return build(null);
  }

  async memories(userId: string, id: string, cursor?: string, limit = 30): Promise<AreaMemoriesPage> {
    await this.access.assertCanManageSpace(userId, id);
    const page = await this.vectors.scroll(
      P.own(userId, { areaIds: [id] }),
      { limit, offset: cursor ?? null },
    );
    const ids = page.points.map((p) => p.id);
    const rows = await this.prisma.memoryIndex.findMany({
      where: { memoryId: { in: ids } },
      select: { memoryId: true, createdAt: true, sensitivity: true },
    });
    const metaById = new Map(rows.map((r) => [r.memoryId, r]));

    const items: AreaMemoryDto[] = page.points.map((p) => {
      const facets = facetsOf(p.payload);
      const meta = metaById.get(p.id);
      return {
        memoryId: p.id,
        text: textOf(p.payload),
        areaIds: facets.areaIds ?? [],
        sensitivity: facets.sensitivity ?? 'normal',
        createdAt: meta?.createdAt.toISOString() ?? null,
      };
    });
    return { items, nextCursor: page.next != null ? String(page.next) : null };
  }

  async sample(userId: string, id: string, n = 3): Promise<{ memoryId: string; text: string }[]> {
    await this.access.assertCanManageSpace(userId, id);
    const page = await this.vectors.scroll(P.own(userId, { areaIds: [id] }), { limit: n });
    return page.points.map((p) => ({ memoryId: p.id, text: textOf(p.payload) }));
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async deriveName(description: string): Promise<string> {
    try {
      const raw = await this.llm.complete(
        `Genera un nombre corto (1 a 3 palabras, sin comillas) para un área de memoria descrita como: "${description}". Responde SOLO el nombre.`,
        { maxTokens: 32, temperature: 0 },
      );
      const cleaned = raw.trim().replace(/^["']|["']$/g, '').slice(0, 60);
      if (cleaned) return cleaned;
    } catch {
      // LLM down — fall back to the description head.
    }
    return description.split(/\s+/).slice(0, 3).join(' ').slice(0, 60) || 'Área';
  }

  private toDto(s: Space, memoryCount: number): AreaDto {
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      parentId: s.parentId,
      depth: s.depth,
      path: s.path,
      isDefault: s.isDefault,
      governance: s.governance,
      memoryCount,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip combining diacritics
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'area'
  );
}

