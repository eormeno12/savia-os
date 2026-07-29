import { AccessPredicate, P } from '../../common/ports/predicate';

/**
 * A fragment a group member contributes (08 §5): their subtree (space). The
 * crucial bit is `ownerUserId` — a fragment only ever exposes ITS owner's
 * memories, so cross-partition reads are confined to what was shared.
 *
 * `includeSensitive` is the fragment OWNER's opt-in (R4): sensitive is a private,
 * global marker, so it never crosses into a group view unless its owner chose to
 * share it on THIS fragment. The reader (a connection or another member) can never
 * lift it — sensitivity is baked into `fragmentScope`, not decided by the grant.
 */
export interface CompiledFragment {
  areaId: string;
  ownerUserId: string;
  includeSensitive: boolean;
}

/** A grant flattened for the (pure) compiler — no Prisma rows reach the compiler. */
export type CompiledGrant =
  | { scope: 'space'; areaId: string; includeSensitive: boolean }
  | { scope: 'group'; fragments: CompiledFragment[]; includeSensitive: boolean };

/** A fragment's read predicate: its scope, its owner's partition, and the owner's
 *  sensitivity opt-in. Group sensitivity lives HERE (per fragment/owner), never on
 *  the reader's grant — so no reader can ever surface another person's sensitive. */
export function fragmentScope(f: CompiledFragment): AccessPredicate {
  const base = P.and(P.areaIdsAny([f.areaId]), P.author(f.ownerUserId));
  return f.includeSensitive ? base : P.and(base, P.sensitivityNormal());
}

/** The single encoding of "a group is the OR of its members' fragments" (08 §5.2).
 *  Used by both the connection access-filter (compiler) and the federation view. */
export function fragmentsPredicate(fragments: CompiledFragment[]): AccessPredicate {
  return P.or(...fragments.map(fragmentScope));
}

/**
 * OCP: one predicate provider per scope (0A F11). Adding a new scope = adding a
 * provider here; the compiler never grows an `if/if/if`. Each provider returns
 * the scope's base predicate (sensitivity is layered on by the compiler).
 */
export type ScopePredicateProvider = (grant: CompiledGrant) => AccessPredicate;

export const SCOPE_PROVIDERS: Record<CompiledGrant['scope'], ScopePredicateProvider> = {
  space: (g) => (g.scope === 'space' ? P.areaIdsAny([g.areaId]) : P.denyAll()),
  group: (g) => (g.scope === 'group' ? fragmentsPredicate(g.fragments) : P.denyAll()),
};

/**
 * A single grant's read predicate WITH sensitivity applied (R4), the one place the
 * rule lives:
 *   - `space` (the reader's OWN area) → the reader's grant opt-in decides.
 *   - `group` (someone's shared fragment) → sensitivity is the fragment OWNER's
 *     opt-in, already baked per-fragment in `fragmentScope`; the reader's grant
 *     never lifts it. So the group base is used as-is.
 * Used by both `compileAccessFilter` (flat) and `compileReadPlan` (per-owner).
 */
export function grantScope(g: CompiledGrant): AccessPredicate {
  const base = SCOPE_PROVIDERS[g.scope](g);
  if (g.scope === 'group') return base; // sensitivity is per-fragment (owner opt-in)
  return g.includeSensitive ? base : P.and(base, P.sensitivityNormal());
}
