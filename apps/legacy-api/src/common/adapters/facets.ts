import { MemoryFacets } from '../ports/predicate';
import { PAYLOAD_KEYS } from './qdrant.connection';

const asStrings = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.map(String) : undefined;

/** Project a Qdrant point payload into the access facets the evaluator reads. */
export function facetsOf(payload: Record<string, unknown>): MemoryFacets {
  return {
    areaIds: asStrings(payload[PAYLOAD_KEYS.areaIds]),
    entities: asStrings(payload[PAYLOAD_KEYS.entities]),
    sensitivity: payload[PAYLOAD_KEYS.sensitivity] === 'sensitive' ? 'sensitive' : 'normal',
    superseded: payload[PAYLOAD_KEYS.superseded] === true,
    userId: typeof payload[PAYLOAD_KEYS.userId] === 'string' ? (payload[PAYLOAD_KEYS.userId] as string) : undefined,
  };
}

/** mem0 stores the memory text under `data` (fallbacks for older points). */
export function textOf(payload: Record<string, unknown>): string {
  return String(payload.data ?? payload.memory ?? payload.text ?? '');
}
