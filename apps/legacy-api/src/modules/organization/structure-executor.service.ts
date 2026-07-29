import { Injectable, Logger } from '@nestjs/common';
import type { EngineNode } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { MemoryMutationService } from '../kernel/memory-mutation.service';
import { AreasService } from '../areas/areas.service';
import { NamingService } from './naming.service';
import { SuggestionsService } from './suggestions.service';

/**
 * The ONLY applier of structural community ops. Everything that changes the area
 * TREE — creating a leaf area for a community, merging two, splitting one, syncing
 * a memory's membership — goes through here, and only ever via the write-kernel +
 * AreasService, so the engine can never cross a scope or hard-delete. The merge
 * path ports verbatim the access-preserving re-homing the old `applyMerge` proved
 * out (MemoryArea/File/FragmentShare re-home under Restrict + Grant collision
 * reconciliation in favour of `includeSensitive`), because a community merge is
 * exactly an area merge under the hood.
 */
@Injectable()
export class StructureExecutorService {
  private readonly logger = new Logger(StructureExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kernel: MemoryMutationService,
    private readonly areas: AreasService,
    private readonly naming: NamingService,
    private readonly suggestions: SuggestionsService,
  ) {}

  /** Create a fresh leaf community: a Space under General + its EngineNode. */
  async createCommunity(userId: string, componentId: string): Promise<EngineNode> {
    const general = await this.areas.ensureGeneral(userId);
    const space = await this.areas.createChild(userId, general, 'Área nueva');
    return this.prisma.engineNode.create({
      data: { userId, componentId, spaceId: space.id, kind: 'community' },
    });
  }

  /** Point a set of personas at a community node (their memories are synced after). */
  async assignPersonas(personaIds: string[], nodeId: string): Promise<void> {
    if (personaIds.length === 0) return;
    await this.prisma.memoryPersona.updateMany({ where: { id: { in: personaIds } }, data: { communityId: nodeId } });
  }

  /**
   * Project a set of memories' community assignments onto MemoryArea (the access
   * truth), via the kernel. A memory's membership = closure of the Spaces of ALL its
   * communities (union across its personas — that is where overlap becomes real
   * multi-area membership). A memory with no community lands in General.
   */
  async syncMembership(userId: string, memoryIds: Iterable<string>): Promise<void> {
    const general = await this.areas.ensureGeneral(userId);
    for (const memoryId of memoryIds) {
      const personas = await this.prisma.memoryPersona.findMany({
        where: { memoryId },
        select: { community: { select: { spaceId: true } } },
      });
      const leafSpaces = [...new Set(personas.map((p) => p.community?.spaceId).filter((s): s is string => !!s))];
      const membership = leafSpaces.length ? await this.areas.closure(leafSpaces) : [general.id];
      await this.kernel.updateMembership(memoryId, userId, membership);
    }
  }

  /**
   * Merge community `drop` into `keep`: reassign drop's personas, then re-home every
   * area-attached artifact and delete drop's Space. Access-preserving by
   * construction (survivor closure carries the ancestors).
   */
  async merge(userId: string, keepNodeId: string, dropNodeId: string): Promise<void> {
    const [keep, drop] = await Promise.all([
      this.prisma.engineNode.findUnique({ where: { id: keepNodeId } }),
      this.prisma.engineNode.findUnique({ where: { id: dropNodeId } }),
    ]);
    if (!keep || !drop) return;
    const survivorId = keep.spaceId;
    const goneId = drop.spaceId;
    const goneSpace = await this.prisma.space.findUnique({ where: { id: goneId } });
    if (!goneSpace || goneSpace.isDefault) return;

    // Reassign drop's personas to keep BEFORE deleting drop's node (else the
    // EngineNode cascade would null their communityId instead of moving them).
    await this.prisma.memoryPersona.updateMany({ where: { communityId: dropNodeId }, data: { communityId: keepNodeId } });

    const survivorClosure = await this.areas.closure([survivorId]);

    // Re-home the remaining MemoryArea rows of the dying area (Restrict — the delete
    // would fail otherwise) to the survivor closure.
    const remaining = await this.prisma.memoryArea.findMany({ where: { spaceId: goneId }, select: { memoryId: true } });
    await this.prisma.memoryArea.deleteMany({ where: { spaceId: goneId } });
    for (const { memoryId } of remaining) {
      await this.prisma.memoryArea.createMany({
        data: survivorClosure.map((sid) => ({ memoryId, spaceId: sid })),
        skipDuplicates: true,
      });
    }

    // File.spaceId is Restrict — re-home before delete (a File lives in one area, no closure).
    await this.prisma.file.updateMany({ where: { spaceId: goneId }, data: { spaceId: survivorId } });

    // Grant collision: a connection granted on BOTH gone and survivor would break the
    // unique(connectionId, spaceId) index on re-home. Reconcile toward includeSensitive,
    // drop the now-redundant duplicate, then bulk-move the rest.
    const [goneGrants, survivorGrants] = await Promise.all([
      this.prisma.grant.findMany({ where: { spaceId: goneId } }),
      this.prisma.grant.findMany({ where: { spaceId: survivorId } }),
    ]);
    const survivorGrantByConn = new Map(survivorGrants.map((g) => [g.connectionId, g]));
    const collidingConns: string[] = [];
    for (const gg of goneGrants) {
      const sg = survivorGrantByConn.get(gg.connectionId);
      if (!sg) continue;
      collidingConns.push(gg.connectionId);
      if (gg.includeSensitive && !sg.includeSensitive) {
        await this.prisma.grant.update({ where: { id: sg.id }, data: { includeSensitive: true } });
      }
    }
    if (collidingConns.length) {
      await this.prisma.grant.deleteMany({ where: { spaceId: goneId, connectionId: { in: collidingConns } } });
    }

    // FragmentShare re-home: like Grant, a member who shared BOTH gone and survivor
    // areas to the same group doubles up on re-home. Reconcile toward includeSensitive
    // (the owner's opt-in never narrows on a merge), drop the duplicate, move the rest.
    const [goneFrags, survivorFrags] = await Promise.all([
      this.prisma.fragmentShare.findMany({ where: { spaceId: goneId } }),
      this.prisma.fragmentShare.findMany({ where: { spaceId: survivorId } }),
    ]);
    const survivorFragByKey = new Map(survivorFrags.map((f) => [`${f.groupId}:${f.userId}`, f]));
    const collidingFragIds: string[] = [];
    for (const gf of goneFrags) {
      const sf = survivorFragByKey.get(`${gf.groupId}:${gf.userId}`);
      if (!sf) continue;
      collidingFragIds.push(gf.id);
      if (gf.includeSensitive && !sf.includeSensitive) {
        await this.prisma.fragmentShare.update({ where: { id: sf.id }, data: { includeSensitive: true } });
      }
    }
    if (collidingFragIds.length) {
      await this.prisma.fragmentShare.deleteMany({ where: { id: { in: collidingFragIds } } });
    }
    await this.prisma.fragmentShare.updateMany({ where: { spaceId: goneId }, data: { spaceId: survivorId } });

    await this.prisma.$transaction([
      this.prisma.grant.updateMany({ where: { spaceId: goneId }, data: { spaceId: survivorId } }),
      this.prisma.space.updateMany({ where: { parentId: goneId }, data: { parentId: survivorId } }),
      this.prisma.space.delete({ where: { id: goneId } }), // cascades the gone EngineNode
    ]);
    await this.areas.reindexFrom(survivorId);
    await this.suggestions.create(
      userId,
      'merge',
      { survivorSpaceId: survivorId, goneSpaceId: goneId, goneName: goneSpace.name },
      'Fusioné dos áreas muy parecidas.',
    );
    this.logger.log(`engine merge ${goneId} → ${survivorId}`);
  }

  /**
   * Split community `node` by moving `groupB` personas into a new community. The
   * memories of the moved personas re-sync their membership afterwards.
   */
  async split(userId: string, node: EngineNode, groupB: string[]): Promise<void> {
    if (groupB.length === 0) return;
    const newNode = await this.createCommunity(userId, node.componentId);
    await this.assignPersonas(groupB, newNode.id);

    const memoryIds = await this.memoriesOfPersonas([...groupB]);
    await this.syncMembership(userId, memoryIds);
    await Promise.all([this.naming.nameArea(userId, node.spaceId), this.naming.nameArea(userId, newNode.spaceId)]);
    await this.suggestions.create(
      userId,
      'split',
      { fromSpaceId: node.spaceId, newSpaceId: newNode.spaceId },
      'Dividí un área en dos temas distintos.',
    );
    this.logger.log(`engine split ${node.spaceId} → +${newNode.spaceId}`);
  }

  private async memoriesOfPersonas(personaIds: string[]): Promise<string[]> {
    const rows = await this.prisma.memoryPersona.findMany({
      where: { id: { in: personaIds } },
      select: { memoryId: true },
    });
    return [...new Set(rows.map((r) => r.memoryId))];
  }
}
