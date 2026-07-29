import { Mem0EntityGraphAdapter } from './entity-graph.mem0.adapter';
import { QdrantConnection } from './qdrant.connection';

function connectionWith(scroll: jest.Mock): QdrantConnection {
  return {
    entityCollectionName: 'test_entities',
    client: { scroll },
    run: jest.fn((fn: () => unknown) => fn()),
  } as unknown as QdrantConnection;
}

const link = (id: string, entity: string, memoryIds: string[], userId: string) => ({
  id,
  payload: { data: entity, linkedMemoryIds: memoryIds, user_id: userId },
});

describe('Mem0EntityGraphAdapter', () => {
  it('paginates across multiple pages until next_page_offset is null', async () => {
    const scroll = jest
      .fn()
      .mockResolvedValueOnce({ points: [link('1', 'a', ['m1'], 'u1')], next_page_offset: 'page-2' })
      .mockResolvedValueOnce({ points: [link('2', 'b', ['m2'], 'u1')], next_page_offset: null });
    const adapter = new Mem0EntityGraphAdapter(connectionWith(scroll));

    const links = await adapter.linksForUser('u1');

    expect(scroll).toHaveBeenCalledTimes(2);
    expect(links).toEqual([
      { entity: 'a', memoryIds: ['m1'] },
      { entity: 'b', memoryIds: ['m2'] },
    ]);
  });

  it('does not stop early on a falsy-but-real next_page_offset (regression: was `while(offset)`)', async () => {
    // mem0 always uses UUID string ids in practice (never numeric 0), but the
    // loop itself must not rely on truthiness — this proves it doesn't.
    const scroll = jest
      .fn()
      .mockResolvedValueOnce({ points: [link('1', 'a', ['m1'], 'u1')], next_page_offset: 0 })
      .mockResolvedValueOnce({ points: [link('2', 'b', ['m2'], 'u1')], next_page_offset: null });
    const adapter = new Mem0EntityGraphAdapter(connectionWith(scroll));

    const links = await adapter.linksForUser('u1');

    expect(scroll).toHaveBeenCalledTimes(2);
    expect(links.map((l) => l.entity)).toEqual(['a', 'b']);
  });

  it('returns [] when the entity store is missing (best-effort, swallowed)', async () => {
    const scroll = jest.fn().mockRejectedValue(new Error('collection not found'));
    const adapter = new Mem0EntityGraphAdapter(connectionWith(scroll));

    expect(await adapter.linksForUser('u1')).toEqual([]);
  });

  it('skips points missing a string `data` or an empty `linkedMemoryIds`', async () => {
    const scroll = jest.fn().mockResolvedValue({
      points: [
        { id: '1', payload: { data: 123, linkedMemoryIds: ['m1'], user_id: 'u1' } },
        { id: '2', payload: { data: 'ok', linkedMemoryIds: [], user_id: 'u1' } },
        link('3', 'good', ['m3'], 'u1'),
      ],
      next_page_offset: null,
    });
    const adapter = new Mem0EntityGraphAdapter(connectionWith(scroll));

    expect(await adapter.linksForUser('u1')).toEqual([{ entity: 'good', memoryIds: ['m3'] }]);
  });
});

describe('Mem0EntityGraphAdapter.entitiesForMemory', () => {
  it('scopes the query to user_id + linkedMemoryIds contains memoryId, server-side', async () => {
    const scroll = jest.fn().mockResolvedValue({ points: [link('1', 'a', ['m1'], 'u1')], next_page_offset: null });
    const adapter = new Mem0EntityGraphAdapter(connectionWith(scroll));

    await adapter.entitiesForMemory('u1', 'm1');

    expect(scroll).toHaveBeenCalledWith(
      'test_entities',
      expect.objectContaining({
        filter: {
          must: [
            { key: 'user_id', match: { value: 'u1' } },
            { key: 'linkedMemoryIds', match: { any: ['m1'] } },
          ],
        },
      }),
    );
  });

  it('returns just the entity names, paginating if needed', async () => {
    const scroll = jest
      .fn()
      .mockResolvedValueOnce({ points: [link('1', 'a', ['m1'], 'u1')], next_page_offset: 'page-2' })
      .mockResolvedValueOnce({ points: [link('2', 'b', ['m1'], 'u1')], next_page_offset: null });
    const adapter = new Mem0EntityGraphAdapter(connectionWith(scroll));

    expect(await adapter.entitiesForMemory('u1', 'm1')).toEqual(['a', 'b']);
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it('returns [] when the entity store is missing (best-effort, swallowed)', async () => {
    const scroll = jest.fn().mockRejectedValue(new Error('collection not found'));
    const adapter = new Mem0EntityGraphAdapter(connectionWith(scroll));

    expect(await adapter.entitiesForMemory('u1', 'm1')).toEqual([]);
  });
});
