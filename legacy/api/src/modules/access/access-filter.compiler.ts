import { AccessPredicate, P } from '../../common/ports/predicate';
import { CompiledGrant, grantScope } from './scope-predicate.provider';

/**
 * The PURE access-filter compiler (0A F3/F18): grants (already flattened by the
 * AccessService) → an AccessPredicate, with no DB and no framework. Because it's
 * pure, the FASE-1 unit suite can prove the four invariants of spec 15 directly:
 *
 *   1. default-deny  — no grants → denyAll
 *   2. clamp         — `requested` can only NARROW (∩), never widen
 *   3. sensitivity   — `sensitive` never flows without opt-in. Space grants gate on
 *                      the reader's own grant; group fragments gate on the fragment
 *                      OWNER's opt-in (R4) — the reader never lifts another person's
 *                      sensitive. Both live in `grantScope`/`fragmentScope`.
 *   4. subtree       — a grant on an area sees its descendants (their membership
 *                      carries the ancestor) but NOT its siblings
 *
 * NOTE: this FLAT form assumes a single-partition read (the reader's own Qdrant
 * partition). Cross-owner group reads must fan out per owner — use
 * {@link compileReadPlan} (read-plan.ts) for that. This function remains the pure
 * statement of the invariants that the unit suite proves against.
 */
export function compileAccessFilter(
  grants: CompiledGrant[],
  requested?: string[],
): AccessPredicate {
  if (grants.length === 0) return P.denyAll(); // (1) default-deny

  // (3) sensitivity is applied inside grantScope, per scope (see its docstring).
  const clauses = grants.map(grantScope);

  let filter = P.or(...clauses);

  // (2) clamp — intersect with the explicitly requested areas. Pure narrowing.
  if (requested && requested.length > 0) {
    filter = P.and(filter, P.areaIdsAny(requested));
  }

  // Reads never surface consolidated duplicates.
  return P.and(filter, P.notSuperseded());
}
