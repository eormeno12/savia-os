import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/clients/prisma.service';
import { MemoryGraphService } from './memory-graph.service';
import { egoSplit, matchPersonas } from './ego-split';

/**
 * Layer [2]: ego-splitting into MemoryPersona rows. For each touched memory it
 * recomputes the ego-net partition and reconciles it against the stored personas,
 * REUSING a matched persona's id (and thus its communityId) so identity — and the
 * area a memory sits in — stays stable across edits rather than churning. A memory
 * with neighbours in disconnected worlds ends up with several personas → it is a
 * full member of several communities (literal overlap). A memory with no mutual
 * neighbours has no persona → the community layer routes it to General.
 */
@Injectable()
export class PersonaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: MemoryGraphService,
  ) {}

  /**
   * Recompute the personas of every memory in `memoryIds`. Returns the ids of all
   * personas that now exist for those memories (matched-kept + newly-created), so
   * the community layer can (re)assign exactly them.
   */
  async recompute(userId: string, memoryIds: Iterable<string>): Promise<string[]> {
    const touched: string[] = [];
    for (const memoryId of memoryIds) {
      touched.push(...(await this.recomputeOne(userId, memoryId)));
    }
    return touched;
  }

  private async recomputeOne(userId: string, memoryId: string): Promise<string[]> {
    const { neighbors, edgesAmong } = await this.graph.egoNet(memoryId);
    const fresh = egoSplit(neighbors, edgesAmong); // Persona[] = disjoint neighbor groups

    const old = await this.prisma.memoryPersona.findMany({
      where: { memoryId },
      include: { neighbors: { select: { neighborId: true } } },
    });
    const mapping = matchPersonas(
      old.map((p) => ({ id: p.id, neighbors: p.neighbors.map((n) => n.neighborId) })),
      fresh,
    );

    // Clear the memory's neighbour rows up front so recreating below can never trip
    // the @@id[memoryId,neighborId] uniqueness as neighbours move between personas.
    await this.prisma.personaNeighbor.deleteMany({ where: { memoryId } });

    const keptIds = new Set<string>();
    const resultIds: string[] = [];
    for (let i = 0; i < fresh.length; i++) {
      const matchedId = mapping[i];
      const personaId =
        matchedId ?? (await this.prisma.memoryPersona.create({ data: { memoryId, userId, communityId: null } })).id;
      if (matchedId) keptIds.add(matchedId);
      await this.prisma.personaNeighbor.createMany({
        data: fresh[i].map((neighborId) => ({ personaId, memoryId, neighborId })),
        skipDuplicates: true,
      });
      resultIds.push(personaId);
    }

    const stale = old.filter((p) => !keptIds.has(p.id)).map((p) => p.id);
    if (stale.length) await this.prisma.memoryPersona.deleteMany({ where: { id: { in: stale } } });

    return resultIds;
  }
}
