import type { MemoryConfig } from 'mem0ai/oss';

/**
 * mem0 OSS config (sidecar, 08 §3). mem0 owns extraction + dedup + embeddings +
 * hybrid search over the SAME Qdrant collection; Savia layers `savia_*` payload
 * and the area tree on top. `infer` defaults to true → the entity store
 * (`{collection}_entities`) is populated for the EntityGraphPort.
 */
export function buildMem0Config(opts: {
  qdrantUrl: string;
  collectionName: string;
  openAiApiKey: string;
}): MemoryConfig {
  return {
    version: 'v1.1',
    disableHistory: true,
    vectorStore: {
      provider: 'qdrant',
      config: {
        url: opts.qdrantUrl,
        collectionName: opts.collectionName,
        dimension: 1536, // explicit → no startup probe embed
      },
    },
    llm: {
      provider: 'openai',
      config: { model: 'gpt-4o-mini', apiKey: opts.openAiApiKey },
    },
    embedder: {
      provider: 'openai',
      config: { model: 'text-embedding-3-small', apiKey: opts.openAiApiKey, embeddingDims: 1536 },
    },
  };
}
