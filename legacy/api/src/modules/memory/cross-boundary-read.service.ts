import { Injectable } from '@nestjs/common';
import type { Sensitivity } from '@savia-os/legacy-contracts';
import { MemoryService } from './memory.service';
import { ReadPartition } from '../access/read-plan';

/** One deduped result of a cross-boundary read, carrying its owner so callers can
 *  attribute it (federation's "también de X") or flatten it (MCP). */
export interface CrossBoundaryHit {
  memoryId: string;
  text: string;
  score: number;
  areaIds: string[];
  sensitivity: Sensitivity;
  ownerUserId: string;
  alsoFrom: string[]; // OTHER owners with the same fact (never the viewer)
}

/**
 * The single executor of a cross-boundary read (08 §5.2 / 0A F6). mem0 partitions
 * candidates per user, so a cross-owner read is a fan-out: search each owner's
 * partition with ITS predicate (built by {@link ReadPartition}), merge, and dedup
 * cross-person. Both the group federation view and the MCP connection path run
 * through here — the ONE place fan-out + dedup live, so neither hand-rolls it.
 */
@Injectable()
export class CrossBoundaryReadService {
  constructor(private readonly memory: MemoryService) {}

  async searchPartitions(
    plan: ReadPartition[],
    query: string,
    limit: number,
    viewerUserId: string,
  ): Promise<CrossBoundaryHit[]> {
    if (plan.length === 0) return []; // default-deny: nothing to search
    const perOwner = await Promise.all(
      plan.map(async ({ ownerUserId, predicate }) => {
        const results = await this.memory.search(ownerUserId, query, predicate, limit);
        return results.map(
          (r): CrossBoundaryHit => ({
            memoryId: r.id,
            text: r.text,
            score: r.score,
            areaIds: r.areaIds,
            sensitivity: r.sensitivity,
            ownerUserId,
            alsoFrom: [],
          }),
        );
      }),
    );
    return dedupeCrossPerson(perOwner.flat(), viewerUserId)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

/** Show one of a cross-person duplicate, attributing the OTHER owners ("también de X").
 *  The viewer is never listed among the "others": their own copy of a shared fact must
 *  not inflate the "también aportado por N personas más" count with themselves. */
export function dedupeCrossPerson(items: CrossBoundaryHit[], viewerUserId?: string): CrossBoundaryHit[] {
  const byText = new Map<string, CrossBoundaryHit>();
  for (const item of items) {
    const key = item.text.trim().toLowerCase();
    const existing = byText.get(key);
    if (!existing) {
      byText.set(key, item);
      continue;
    }
    if (item.score > existing.score) existing.score = item.score;
    if (
      item.ownerUserId !== existing.ownerUserId &&
      item.ownerUserId !== viewerUserId &&
      !existing.alsoFrom.includes(item.ownerUserId)
    ) {
      existing.alsoFrom.push(item.ownerUserId);
    }
  }
  return [...byText.values()];
}
