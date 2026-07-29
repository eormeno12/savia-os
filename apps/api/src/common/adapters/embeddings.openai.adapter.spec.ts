import { OpenAiEmbeddingsAdapter } from './embeddings.openai.adapter';
import { OpenAiClient } from './openai.client';
import { UnavailableError } from '../errors/domain-error';
import { norm } from '../math/vector';

function clientWith(create: jest.Mock): OpenAiClient {
  return {
    raw: { embeddings: { create } },
    run: <T>(fn: () => Promise<T>) => fn(), // pass-through breaker for the test
  } as unknown as OpenAiClient;
}

describe('OpenAiEmbeddingsAdapter', () => {
  it('renormalizes returned embeddings to unit length', async () => {
    const create = jest.fn().mockResolvedValue({ data: [{ embedding: [3, 4] }] });
    const adapter = new OpenAiEmbeddingsAdapter(clientWith(create));

    const [vec] = await adapter.embed(['hello']);

    expect(norm(vec)).toBeCloseTo(1, 10);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ input: ['hello'] }));
  });

  it('passes dims through as the OpenAI dimensions param', async () => {
    const create = jest.fn().mockResolvedValue({ data: [{ embedding: [1, 0] }] });
    const adapter = new OpenAiEmbeddingsAdapter(clientWith(create));

    await adapter.embed(['x'], { dims: 256 });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ dimensions: 256 }));
  });

  it('returns [] for empty input without calling the API', async () => {
    const create = jest.fn();
    const adapter = new OpenAiEmbeddingsAdapter(clientWith(create));
    expect(await adapter.embed([])).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('maps provider failures to UnavailableError (clean 503, not 500)', async () => {
    const create = jest.fn().mockRejectedValue(new Error('boom'));
    const adapter = new OpenAiEmbeddingsAdapter(clientWith(create));
    await expect(adapter.embed(['x'])).rejects.toBeInstanceOf(UnavailableError);
  });
});
