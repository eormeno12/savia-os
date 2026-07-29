/**
 * Access predicate — a vendor-neutral AST that the domain (AccessService, the
 * organization engine) builds, and the VectorStorePort adapter compiles to the
 * concrete store's filter language (Qdrant today).
 *
 * The point of this seam (0A F7/F9): the domain never speaks raw Qdrant filter
 * JSON. It speaks "area_ids ANY [...]", "not superseded", "normal sensitivity",
 * combined with and/or. Default-deny is a first-class node (`denyAll`).
 *
 * `evaluate()` gives the SAME predicate an in-memory semantics over a memory's
 * facets — so a unit test can prove "this payload is/ isn't visible to this set
 * of grants" without any infrastructure. That is the test that closes IDOR and
 * over-share (FASE-1).
 */

export type AccessPredicate =
  | { t: 'areaIdsAny'; areaIds: string[] } // membership: savia_area_ids ∩ areaIds ≠ ∅
  | { t: 'author'; userId: string } // provenance/partition: user_id = userId
  | { t: 'entitiesAny'; entities: string[] } // savia_entities ∩ entities ≠ ∅
  | { t: 'sensitivityNormal' } // exclude sensitive
  | { t: 'notSuperseded' } // exclude consolidated dups
  | { t: 'and'; clauses: AccessPredicate[] }
  | { t: 'or'; clauses: AccessPredicate[] }
  | { t: 'denyAll' }; // matches nothing — the default

export const P = {
  areaIdsAny: (areaIds: string[]): AccessPredicate =>
    areaIds.length === 0 ? { t: 'denyAll' } : { t: 'areaIdsAny', areaIds },
  author: (userId: string): AccessPredicate => ({ t: 'author', userId }),
  entitiesAny: (entities: string[]): AccessPredicate =>
    entities.length === 0 ? { t: 'denyAll' } : { t: 'entitiesAny', entities },
  sensitivityNormal: (): AccessPredicate => ({ t: 'sensitivityNormal' }),
  notSuperseded: (): AccessPredicate => ({ t: 'notSuperseded' }),
  and: (...clauses: AccessPredicate[]): AccessPredicate => {
    if (clauses.some((c) => c.t === 'denyAll')) return { t: 'denyAll' };
    const real = clauses.filter((c) => !isTautology(c));
    if (real.length === 0) return { t: 'and', clauses: [] }; // matches all
    if (real.length === 1) return real[0];
    return { t: 'and', clauses: real };
  },
  or: (...clauses: AccessPredicate[]): AccessPredicate => {
    const real = clauses.filter((c) => c.t !== 'denyAll');
    if (real.length === 0) return { t: 'denyAll' };
    if (real.length === 1) return real[0];
    return { t: 'or', clauses: real };
  },
  denyAll: (): AccessPredicate => ({ t: 'denyAll' }),

  /**
   * "My readable memories" — the canonical OWNER-SCOPED read predicate: a user's own
   * partition (`author`), minus consolidated duplicates. It can never leak another
   * person's data (the `author` clause pins it), so unlike a grant it is safe to build
   * by hand — this helper just keeps the shape uniform so no owner-scoped read forgets
   * `notSuperseded`.
   *
   * NOTE the owner-scoped semantics of `areaIds`, OPPOSITE to a grant: an empty/omitted
   * list means "ALL my areas" (no area constraint), NOT `denyAll`. Default-deny is a
   * grant concept; scanning your own memory with no area filter means everything.
   *   - `areaIds`: constrain to these areas (empty/omitted → all my areas).
   *   - `includeSuperseded`: keep superseded points too (export/delete, or a membership
   *     rewrite that must touch superseded points). Default excludes them.
   */
  own: (userId: string, opts: { areaIds?: string[]; includeSuperseded?: boolean } = {}): AccessPredicate => {
    const clauses: AccessPredicate[] = [P.author(userId)];
    if (!opts.includeSuperseded) clauses.push(P.notSuperseded());
    if (opts.areaIds && opts.areaIds.length > 0) clauses.push(P.areaIdsAny(opts.areaIds));
    return P.and(...clauses);
  },
};

function isTautology(p: AccessPredicate): boolean {
  return p.t === 'and' && p.clauses.length === 0;
}

/** True if the predicate can never match anything → callers must short-circuit. */
export function isDenyAll(p: AccessPredicate): boolean {
  if (p.t === 'denyAll') return true;
  if (p.t === 'or') return p.clauses.every(isDenyAll);
  if (p.t === 'and') return p.clauses.some(isDenyAll);
  return false;
}

/** The visible facets of a memory — the normalized view the evaluator reads. */
export interface MemoryFacets {
  areaIds?: string[];
  entities?: string[];
  sensitivity?: 'normal' | 'sensitive';
  superseded?: boolean;
  userId?: string;
}

const overlaps = (a: string[] | undefined, b: string[]): boolean => {
  if (!a || a.length === 0) return false;
  const set = new Set(a);
  return b.some((x) => set.has(x));
};

/** In-memory semantics of an AccessPredicate over a memory's facets. */
export function evaluate(p: AccessPredicate, f: MemoryFacets): boolean {
  switch (p.t) {
    case 'areaIdsAny':
      return overlaps(f.areaIds, p.areaIds);
    case 'entitiesAny':
      return overlaps(f.entities, p.entities);
    case 'author':
      return f.userId === p.userId;
    case 'sensitivityNormal':
      return (f.sensitivity ?? 'normal') !== 'sensitive';
    case 'notSuperseded':
      return f.superseded !== true;
    case 'and':
      return p.clauses.every((c) => evaluate(c, f));
    case 'or':
      return p.clauses.some((c) => evaluate(c, f));
    case 'denyAll':
      return false;
  }
}
