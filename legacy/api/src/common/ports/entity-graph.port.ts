/**
 * EntityGraphPort — the ONLY component that knows about mem0's
 * `{collection}_entities` store (0A F9). mem0 extracts entities syntactically
 * (regex + compromise, no LLM) and links each entity to memory ids; this port
 * exposes that bipartite graph as a SECONDARY organization signal.
 *
 * Best-effort by contract (mem0 populates it in a swallowed try/catch): callers
 * must tolerate missing/partial links and never treat it as the spine.
 */
export interface EntityLink {
  entity: string; // the entity text (mem0's `data`)
  memoryIds: string[]; // mem0's `linkedMemoryIds`
}

export abstract class EntityGraphPort {
  /** entity text → linked memory ids, for one user's partition. */
  abstract linksForUser(userId: string): Promise<EntityLink[]>;

  /** memoryId → its entities (inverted from {@link linksForUser}). */
  async entitiesByMemory(userId: string): Promise<Map<string, string[]>> {
    const links = await this.linksForUser(userId);
    const out = new Map<string, string[]>();
    for (const { entity, memoryIds } of links) {
      for (const id of memoryIds) {
        const list = out.get(id) ?? [];
        list.push(entity);
        out.set(id, list);
      }
    }
    return out;
  }

  /** Entities linked to a single memory. Default derives it from the full
   *  per-user graph — override with an indexed lookup when the adapter can do
   *  better (routing calls this once per new memory, so O(whole graph) here
   *  scales badly with account size). */
  async entitiesForMemory(userId: string, memoryId: string): Promise<string[]> {
    return (await this.entitiesByMemory(userId)).get(memoryId) ?? [];
  }
}
