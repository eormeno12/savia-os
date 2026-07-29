import { AppConfig } from '../config/app.config';
import { QdrantConnection } from './qdrant.connection';
import { QdrantVectorStoreAdapter } from './vector-store.qdrant.adapter';
import { P } from '../ports/predicate';

const TEST_COLLECTION = `test_qdrant_filter_e2e_${Date.now()}`;
const VEC = new Array(1536).fill(0.01);

function fakeConfig(): AppConfig {
  return {
    qdrantUrl: process.env.QDRANT_URL ?? 'http://localhost:6333',
    qdrantCollection: TEST_COLLECTION,
  } as AppConfig;
}

/**
 * `qdrant-filter.spec.ts` only checks the shape `compilePredicate` emits — it
 * never proves Qdrant actually evaluates that shape the way `evaluate()`
 * assumes. Two things specifically don't follow from Elasticsearch intuition:
 * `should` is a hard boolean requirement even alongside a sibling `must` (not
 * a relevance-only booster), and an empty `must: []` (the `P.and()` "matches
 * all" tautology) is vacuously true rather than an error or empty match. Run
 * against a real Qdrant instance to close that gap. `TEST_E2E=1` only.
 */
describe('compilePredicate against a real Qdrant instance', () => {
  let connection: QdrantConnection;
  let adapter: QdrantVectorStoreAdapter;

  beforeAll(async () => {
    connection = new QdrantConnection(fakeConfig());
    await connection.ensureCollection();
    adapter = new QdrantVectorStoreAdapter(connection);

    await connection.client.upsert(TEST_COLLECTION, {
      wait: true,
      points: [
        { id: 1, vector: VEC, payload: { user_id: 'alice', savia_area_ids: ['areaA'] } },
        { id: 2, vector: VEC, payload: { user_id: 'bob', savia_area_ids: ['areaA'] } },
        { id: 3, vector: VEC, payload: { user_id: 'alice', savia_area_ids: ['areaB'] } },
        { id: 4, vector: VEC, payload: { user_id: 'bob', savia_area_ids: ['areaB'], savia_sensitivity: 'sensitive' } },
      ],
    });
  }, 30_000);

  afterAll(async () => {
    await connection.client.deleteCollection(TEST_COLLECTION);
  });

  it("and(author, or(areaA, areaB)) matches only the author's points, across both areas", async () => {
    const predicate = P.and(P.author('alice'), P.or(P.areaIdsAny(['areaA']), P.areaIdsAny(['areaB'])));
    const { points } = await adapter.scroll(predicate, { limit: 10 });
    expect(points.map((p) => p.id).sort()).toEqual(['1', '3']);
  });

  it('sensitivityNormal excludes only the explicitly-sensitive point, not the ones missing the key', async () => {
    const { points } = await adapter.scroll(P.sensitivityNormal(), { limit: 10 });
    expect(points.map((p) => p.id).sort()).toEqual(['1', '2', '3']);
  });

  it('a bare P.and() (empty, "matches all") returns every point', async () => {
    const { points } = await adapter.scroll(P.and(), { limit: 10 });
    expect(points.map((p) => p.id).sort()).toEqual(['1', '2', '3', '4']);
  });
});
