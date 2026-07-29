import { Injectable } from '@nestjs/common';
import {
  ScrollOptions,
  ScrollPage,
  VectorPoint,
  VectorStorePort,
} from '../ports/vector-store.port';
import { AccessPredicate, evaluate, isDenyAll } from '../ports/predicate';
import { truncate } from '../math/vector';
import { QdrantConnection } from './qdrant.connection';
import { compilePredicate } from './qdrant-filter';
import { facetsOf } from './facets';
import { UnavailableError } from '../errors/domain-error';

@Injectable()
export class QdrantVectorStoreAdapter extends VectorStorePort {
  constructor(private readonly qdrant: QdrantConnection) {
    super();
  }

  private get col(): string {
    return this.qdrant.collectionName;
  }

  /** Routes every Qdrant call through the shared circuit breaker (D8): an
   *  outage fails fast and surfaces as a clean 503, never a raw 500. */
  private async guarded<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.qdrant.run(fn);
    } catch {
      throw new UnavailableError('Vector store unavailable', 'VectorStoreUnavailable');
    }
  }

  async knn(vector: number[], predicate: AccessPredicate, k: number): Promise<VectorPoint[]> {
    if (isDenyAll(predicate)) return []; // fail-closed, no network call
    const hits = await this.guarded(() =>
      this.qdrant.client.search(this.col, {
        vector,
        filter: compilePredicate(predicate),
        limit: k,
        with_payload: true,
      }),
    );
    return hits.map((h) => this.toPoint(h));
  }

  async scroll(predicate: AccessPredicate, opts: ScrollOptions = {}): Promise<ScrollPage> {
    if (isDenyAll(predicate)) return { points: [], next: null };
    const res = await this.guarded(() =>
      this.qdrant.client.scroll(this.col, {
        filter: compilePredicate(predicate),
        with_payload: true,
        with_vector: opts.withVectors ?? false,
        limit: opts.limit ?? 256,
        offset: opts.offset ?? undefined,
      }),
    );
    return {
      points: res.points.map((p) => this.toPoint(p, opts.dims)),
      next: (res.next_page_offset as string | number | null) ?? null,
    };
  }

  async retrieve(
    ids: string[],
    predicate: AccessPredicate,
    opts: { withVectors?: boolean; dims?: number } = {},
  ): Promise<VectorPoint[]> {
    if (ids.length === 0 || isDenyAll(predicate)) return [];
    const res = await this.guarded(() =>
      this.qdrant.client.retrieve(this.col, {
        ids,
        with_payload: true,
        with_vector: opts.withVectors ?? false,
      }),
    );
    return res
      .map((p) => this.toPoint(p, opts.dims))
      .filter((p) => evaluate(predicate, facetsOf(p.payload)));
  }

  async setPayload(
    ids: string[],
    predicate: AccessPredicate,
    payload: Record<string, unknown>,
    opts: { wait?: boolean } = {},
  ): Promise<void> {
    const validIds = await this.filterOwned(ids, predicate);
    if (validIds.length === 0) return;
    await this.guarded(() =>
      this.qdrant.client.setPayload(this.col, {
        payload,
        points: validIds,
        wait: opts.wait ?? true,
      }),
    );
  }

  async deletePoints(ids: string[], predicate: AccessPredicate, opts: { wait?: boolean } = {}): Promise<void> {
    const validIds = await this.filterOwned(ids, predicate);
    if (validIds.length === 0) return;
    await this.guarded(() => this.qdrant.client.delete(this.col, { points: validIds, wait: opts.wait ?? true }));
  }

  /** Fetches `ids` and narrows to those whose payload satisfies `predicate` —
   *  so a by-id mutation can never touch a point the caller shouldn't see. */
  private async filterOwned(ids: string[], predicate: AccessPredicate): Promise<string[]> {
    if (ids.length === 0 || isDenyAll(predicate)) return [];
    const res = await this.guarded(() =>
      this.qdrant.client.retrieve(this.col, { ids, with_payload: true, with_vector: false }),
    );
    return res
      .filter((p) => evaluate(predicate, facetsOf((p.payload as Record<string, unknown>) ?? {})))
      .map((p) => String(p.id));
  }

  async deleteByPredicate(predicate: AccessPredicate, opts: { wait?: boolean } = {}): Promise<void> {
    if (isDenyAll(predicate)) return; // never mass-delete on an empty scope
    await this.guarded(() =>
      this.qdrant.client.delete(this.col, {
        filter: compilePredicate(predicate),
        wait: opts.wait ?? true,
      }),
    );
  }

  private toPoint(
    raw: { id: string | number; payload?: unknown; vector?: unknown; score?: number },
    dims?: number,
  ): VectorPoint {
    let vector: number[] | undefined;
    if (Array.isArray(raw.vector)) {
      vector = dims ? truncate(raw.vector as number[], dims) : (raw.vector as number[]);
    }
    return {
      id: String(raw.id),
      payload: (raw.payload as Record<string, unknown>) ?? {},
      vector,
      score: raw.score,
    };
  }
}
