/**
 * EmbeddingsPort — the only way the domain turns text into vectors. One adapter
 * (OpenAI today) lives behind it; no module constructs an embeddings client.
 *
 * `dims` selects the Matryoshka fidelity: 256 for clustering geometry, 1536
 * (default) for retrieval/dedup. Returned vectors are unit-length.
 */
export abstract class EmbeddingsPort {
  abstract embed(texts: string[], opts?: { dims?: number }): Promise<number[][]>;

  async embedOne(text: string, opts?: { dims?: number }): Promise<number[]> {
    const [v] = await this.embed([text], opts);
    return v;
  }
}
