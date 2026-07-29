import { Injectable, Logger } from '@nestjs/common';
import { EntityGraphPort, EntityLink } from '../ports/entity-graph.port';
import { QdrantConnection } from './qdrant.connection';

/**
 * Reads mem0's `{collection}_entities` store. Each entity point carries
 * `{ data: <entity text>, linkedMemoryIds: string[], user_id }` (verified in
 * mem0 oss 3.0.9 source). Scoped by `user_id` to respect partitioning.
 *
 * Best-effort: mem0 populates this in a swallowed try/catch, so a missing
 * collection or empty result is normal, not an error.
 */
@Injectable()
export class Mem0EntityGraphAdapter extends EntityGraphPort {
  private readonly logger = new Logger(Mem0EntityGraphAdapter.name);

  constructor(private readonly qdrant: QdrantConnection) {
    super();
  }

  async linksForUser(userId: string): Promise<EntityLink[]> {
    const links: EntityLink[] = [];
    let offset: string | number | null | undefined = undefined;
    try {
      do {
        const res = await this.qdrant.run(() =>
          this.qdrant.client.scroll(this.qdrant.entityCollectionName, {
            filter: { must: [{ key: 'user_id', match: { value: userId } }] },
            with_payload: true,
            with_vector: false,
            limit: 1000,
            offset: offset ?? undefined,
          }),
        );
        for (const p of res.points) {
          const payload = (p.payload ?? {}) as { data?: unknown; linkedMemoryIds?: unknown };
          const entity = typeof payload.data === 'string' ? payload.data : null;
          const memoryIds = Array.isArray(payload.linkedMemoryIds)
            ? (payload.linkedMemoryIds as unknown[]).map(String)
            : [];
          if (entity && memoryIds.length > 0) links.push({ entity, memoryIds });
        }
        offset = (res.next_page_offset as string | number | null) ?? null;
      } while (offset !== null);
    } catch (err) {
      // mem0 may not have created the entity store yet (infer:false, or no adds).
      this.logger.debug(`entity store unavailable for user=${userId}: ${(err as Error).message}`);
      return [];
    }
    return links;
  }

  /** Same store as linksForUser, but filtered server-side to entities linked
   *  to this one memory instead of pulling the user's whole entity graph. */
  async entitiesForMemory(userId: string, memoryId: string): Promise<string[]> {
    const entities: string[] = [];
    let offset: string | number | null | undefined = undefined;
    try {
      do {
        const res = await this.qdrant.run(() =>
          this.qdrant.client.scroll(this.qdrant.entityCollectionName, {
            filter: {
              must: [
                { key: 'user_id', match: { value: userId } },
                { key: 'linkedMemoryIds', match: { any: [memoryId] } },
              ],
            },
            with_payload: true,
            with_vector: false,
            limit: 1000,
            offset: offset ?? undefined,
          }),
        );
        for (const p of res.points) {
          const payload = (p.payload ?? {}) as { data?: unknown };
          if (typeof payload.data === 'string') entities.push(payload.data);
        }
        offset = (res.next_page_offset as string | number | null) ?? null;
      } while (offset !== null);
    } catch (err) {
      this.logger.debug(`entity lookup unavailable for memory=${memoryId}: ${(err as Error).message}`);
      return [];
    }
    return entities;
  }
}
