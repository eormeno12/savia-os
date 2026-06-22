export function buildMem0Config(opts: {
  qdrantUrl: string;
  collectionName: string;
  openAiApiKey: string;
}) {
  return {
    version: 'v1.1',
    disableHistory: true,
    vectorStore: {
      provider: 'qdrant',
      config: {
        url: opts.qdrantUrl,
        collectionName: opts.collectionName,
        // explicit dimension avoids a probe embedding call at startup
        dimension: 1536,
      },
    },
    llm: {
      provider: 'openai',
      config: {
        model: 'gpt-4o-mini',
        apiKey: opts.openAiApiKey,
      },
    },
    embedder: {
      provider: 'openai',
      config: {
        model: 'text-embedding-3-small',
        apiKey: opts.openAiApiKey,
        embeddingDims: 1536,
      },
    },
  };
}
