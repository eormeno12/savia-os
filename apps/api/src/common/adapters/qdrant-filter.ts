import { AccessPredicate } from '../ports/predicate';
import { PAYLOAD_KEYS } from './qdrant.connection';

type Condition = Record<string, unknown>;
// A clause is either a leaf condition or a nested filter (Qdrant allows both).
type Clause = Condition | QdrantFilter;
export interface QdrantFilter {
  must?: Clause[];
  should?: Clause[];
  must_not?: Clause[];
}

// A condition on a key that is never written → matches no points (the denyAll net).
const MATCH_NONE: Condition = { key: '__savia_deny__', match: { value: true } };

/**
 * Pure compiler: AccessPredicate → Qdrant filter. Qdrant lets a `must`/`should`
 * entry be itself a nested filter object, so and/or recurse cleanly. This is the
 * ONLY place that knows Qdrant's filter dialect (0A F7/F9).
 */
export function compilePredicate(p: AccessPredicate): QdrantFilter {
  switch (p.t) {
    case 'areaIdsAny':
      return { must: [{ key: PAYLOAD_KEYS.areaIds, match: { any: p.areaIds } }] };
    case 'author':
      return { must: [{ key: PAYLOAD_KEYS.userId, match: { value: p.userId } }] };
    case 'entitiesAny':
      return { must: [{ key: PAYLOAD_KEYS.entities, match: { any: p.entities } }] };
    case 'sensitivityNormal':
      return { must_not: [{ key: PAYLOAD_KEYS.sensitivity, match: { value: 'sensitive' } }] };
    case 'notSuperseded':
      return { must_not: [{ key: PAYLOAD_KEYS.superseded, match: { value: true } }] };
    case 'and':
      return { must: p.clauses.map(compilePredicate) };
    case 'or':
      return { should: p.clauses.map(compilePredicate) };
    case 'denyAll':
      return { must: [MATCH_NONE] };
  }
}
