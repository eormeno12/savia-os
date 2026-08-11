import { AccessPredicate, P, isDenyAll } from '../../common/ports/predicate';
import { CompiledGrant, fragmentScope, grantScope } from './scope-predicate.provider';

/**
 * One owner partition to search. mem0/Qdrant candidates are generated per
 * user partition (`searchCandidates(ownerUserId)`), so a cross-owner read is
 * inherently a fan-out: one `{ ownerUserId, predicate }` per owner whose data
 * the reader may see.
 */
export interface ReadPartition {
  ownerUserId: string;
  predicate: AccessPredicate;
}

/**
 * The PURE, single home of every cross-boundary read frontier (0A F3 / spec-15).
 * Both the MCP connection path and the group federation view compile their grants
 * here, so the four invariants — and R4 sensitivity — live in exactly ONE place:
 *
 *   1. default-deny — no grants / no fragments → `[]` (nothing to search).
 *   2. clamp        — `requested` only narrows each partition (∩), never widens.
 *   3. sensitivity  — space grants gate on the reader's own opt-in; group fragments
 *                     gate on the fragment OWNER's opt-in, baked in `fragmentScope`.
 *                     A reader's grant NEVER lifts another person's sensitive.
 *   4. subtree      — membership carries ancestors, so a grant on an area matches
 *                     its descendants (via `areaIdsAny`) but not its siblings.
 *
 * A `space` grant is always the reader's own area → its partition owner is the
 * reader. A `group` grant fans out: one partition per fragment owner, each pinned
 * to that owner via `fragmentScope`'s `author` clause. Clauses for the same owner
 * are OR'd into a single partition. Superseded is always excluded from reads.
 */
export function compileReadPlan(
  grants: CompiledGrant[],
  readerUserId: string,
  requested?: string[],
): ReadPartition[] {
  const byOwner = new Map<string, AccessPredicate[]>();
  const push = (ownerUserId: string, clause: AccessPredicate) => {
    const list = byOwner.get(ownerUserId) ?? [];
    list.push(clause);
    byOwner.set(ownerUserId, list);
  };

  for (const g of grants) {
    if (g.scope === 'space') {
      // Own area → the reader's partition; sensitivity per the reader's grant.
      push(readerUserId, grantScope(g));
    } else {
      // Group → one partition per fragment owner; sensitivity is the owner's opt-in.
      for (const f of g.fragments) push(f.ownerUserId, fragmentScope(f));
    }
  }

  const partitions: ReadPartition[] = [];
  for (const [ownerUserId, clauses] of byOwner) {
    let predicate = P.or(...clauses);
    if (requested && requested.length > 0) {
      predicate = P.and(predicate, P.areaIdsAny(requested)); // (2) clamp — pure narrowing
    }
    predicate = P.and(predicate, P.notSuperseded());
    if (!isDenyAll(predicate)) partitions.push({ ownerUserId, predicate });
  }
  return partitions;
}
