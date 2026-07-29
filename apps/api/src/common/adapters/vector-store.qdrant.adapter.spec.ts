import { QdrantVectorStoreAdapter } from './vector-store.qdrant.adapter';
import { QdrantConnection, PAYLOAD_KEYS } from './qdrant.connection';
import { P } from '../ports/predicate';
import { UnavailableError } from '../errors/domain-error';

function connectionWith(overrides: {
  retrieve?: jest.Mock;
  setPayload?: jest.Mock;
  delete?: jest.Mock;
}): QdrantConnection {
  return {
    collectionName: 'test_collection',
    client: {
      retrieve: overrides.retrieve ?? jest.fn(),
      setPayload: overrides.setPayload ?? jest.fn(),
      delete: overrides.delete ?? jest.fn(),
      scroll: jest.fn(),
      search: jest.fn(),
    },
    // Passthrough — the breaker itself is covered by circuit-breaker.spec.ts.
    run: jest.fn((fn: () => unknown) => fn()),
  } as unknown as QdrantConnection;
}

const pointOf = (id: string, userId: string) => ({
  id,
  payload: { [PAYLOAD_KEYS.userId]: userId },
});

describe('QdrantVectorStoreAdapter — retrieve/setPayload/deletePoints require a predicate', () => {
  it('retrieve excludes points whose payload does not satisfy the predicate', async () => {
    const retrieve = jest.fn().mockResolvedValue([pointOf('a', 'u1'), pointOf('b', 'u2')]);
    const adapter = new QdrantVectorStoreAdapter(connectionWith({ retrieve }));

    const points = await adapter.retrieve(['a', 'b'], P.author('u1'));

    expect(points.map((p) => p.id)).toEqual(['a']);
  });

  it('retrieve short-circuits on denyAll without a network call', async () => {
    const retrieve = jest.fn();
    const adapter = new QdrantVectorStoreAdapter(connectionWith({ retrieve }));

    expect(await adapter.retrieve(['a'], P.denyAll())).toEqual([]);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('setPayload only mutates ids that satisfy the predicate', async () => {
    const retrieve = jest.fn().mockResolvedValue([pointOf('a', 'u1'), pointOf('b', 'u2')]);
    const setPayload = jest.fn();
    const adapter = new QdrantVectorStoreAdapter(connectionWith({ retrieve, setPayload }));

    await adapter.setPayload(['a', 'b'], P.author('u1'), { foo: 'bar' });

    expect(setPayload).toHaveBeenCalledWith(
      'test_collection',
      expect.objectContaining({ points: ['a'], payload: { foo: 'bar' } }),
    );
  });

  it('setPayload never calls the native op if nothing survives the predicate', async () => {
    const retrieve = jest.fn().mockResolvedValue([pointOf('a', 'u2')]);
    const setPayload = jest.fn();
    const adapter = new QdrantVectorStoreAdapter(connectionWith({ retrieve, setPayload }));

    await adapter.setPayload(['a'], P.author('u1'), { foo: 'bar' });

    expect(setPayload).not.toHaveBeenCalled();
  });

  it('deletePoints only deletes ids that satisfy the predicate', async () => {
    const retrieve = jest.fn().mockResolvedValue([pointOf('a', 'u1'), pointOf('b', 'u2')]);
    const del = jest.fn();
    const adapter = new QdrantVectorStoreAdapter(connectionWith({ retrieve, delete: del }));

    await adapter.deletePoints(['a', 'b'], P.author('u1'));

    expect(del).toHaveBeenCalledWith('test_collection', expect.objectContaining({ points: ['a'] }));
  });

  it('deletePoints short-circuits on denyAll without touching Qdrant', async () => {
    const retrieve = jest.fn();
    const del = jest.fn();
    const adapter = new QdrantVectorStoreAdapter(connectionWith({ retrieve, delete: del }));

    await adapter.deletePoints(['a'], P.denyAll());

    expect(retrieve).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('maps a Qdrant outage to a clean UnavailableError (503), not a raw 500', async () => {
    const retrieve = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const adapter = new QdrantVectorStoreAdapter(connectionWith({ retrieve }));

    await expect(adapter.retrieve(['a'], P.author('u1'))).rejects.toBeInstanceOf(UnavailableError);
  });
});
