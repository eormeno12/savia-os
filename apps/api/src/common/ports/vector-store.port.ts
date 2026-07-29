import { AccessPredicate } from './predicate';

export interface VectorPoint {
  id: string;
  payload: Record<string, unknown>;
  vector?: number[];
  score?: number;
}

export interface ScrollPage {
  points: VectorPoint[];
  next: string | number | null; // cursor for the next page, null when exhausted
}

export interface ScrollOptions {
  withVectors?: boolean;
  dims?: number; // Matryoshka truncation applied to returned vectors
  limit?: number;
  offset?: string | number | null;
}

/**
 * VectorStorePort — the domain's view of the vector store. Crucially, EVERY
 * operation here takes an {@link AccessPredicate}, NOT a raw filter (0A F7/F9):
 * the adapter is the only place that knows Qdrant's filter syntax. A `denyAll`
 * predicate short-circuits to empty without a network call.
 *
 * `retrieve`/`setPayload`/`deletePoints` operate by explicit id, but still take
 * a predicate — the adapter enforces it against each fetched point's facets
 * (reusing {@link evaluate}), so an id a caller shouldn't see is silently
 * excluded/never mutated rather than trusted blindly.
 */
export abstract class VectorStorePort {
  abstract knn(vector: number[], predicate: AccessPredicate, k: number): Promise<VectorPoint[]>;
  abstract scroll(predicate: AccessPredicate, opts?: ScrollOptions): Promise<ScrollPage>;
  abstract retrieve(
    ids: string[],
    predicate: AccessPredicate,
    opts?: { withVectors?: boolean; dims?: number },
  ): Promise<VectorPoint[]>;
  abstract setPayload(
    ids: string[],
    predicate: AccessPredicate,
    payload: Record<string, unknown>,
    opts?: { wait?: boolean },
  ): Promise<void>;
  abstract deletePoints(ids: string[], predicate: AccessPredicate, opts?: { wait?: boolean }): Promise<void>;
  abstract deleteByPredicate(predicate: AccessPredicate, opts?: { wait?: boolean }): Promise<void>;
}
