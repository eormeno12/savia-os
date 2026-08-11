import { Mem0Service } from './mem0.service';
import type { AppConfig } from '../../common/config/app.config';
import type { QdrantConnection } from '../../common/adapters/qdrant.connection';

const add = jest.fn();
const search = jest.fn();

jest.mock('mem0ai/oss', () => ({
  Memory: jest.fn().mockImplementation(() => ({ add, search })),
}));

function makeService(): Mem0Service {
  const config = { openaiApiKey: 'sk-test' } as AppConfig;
  const qdrant = { baseUrl: 'http://qdrant', collectionName: 'savia' } as QdrantConnection;
  const svc = new Mem0Service(config, qdrant);
  svc.onModuleInit();
  return svc;
}

describe('Mem0Service.searchCandidates', () => {
  it('passes the requested limit as topK — mem0 reads `topK`, not `limit` (real SDK field name)', async () => {
    search.mockResolvedValue({ results: [] });
    const svc = makeService();

    await svc.searchCandidates('alice', 'query', 50);

    expect(search).toHaveBeenCalledWith('query', { filters: { user_id: 'alice' }, topK: 50 });
  });
});

describe('Mem0Service.add', () => {
  it('keeps a result with no event tag and one explicitly tagged ADD', async () => {
    add.mockResolvedValue({
      results: [
        { id: '1', memory: 'no tag', metadata: {} },
        { id: '2', memory: 'tagged add', metadata: { event: 'ADD' } },
      ],
    });
    const svc = makeService();

    const facts = await svc.add('alice', 'text');

    expect(facts).toEqual([
      { id: '1', text: 'no tag' },
      { id: '2', text: 'tagged add' },
    ]);
  });

  it('drops a result whose event tag lives at `metadata.event`, not top-level `event`', async () => {
    add.mockResolvedValue({
      results: [{ id: '3', memory: 'updated', metadata: { event: 'UPDATE' } }],
    });
    const svc = makeService();

    const facts = await svc.add('alice', 'text');

    expect(facts).toEqual([]);
  });
});
