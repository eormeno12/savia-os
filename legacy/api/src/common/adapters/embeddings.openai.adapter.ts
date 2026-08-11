import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingsPort } from '../ports/embeddings.port';
import { renorm } from '../math/vector';
import { UnavailableError } from '../errors/domain-error';
import { OpenAiClient } from './openai.client';

const EMBEDDING_MODEL = 'text-embedding-3-small';

@Injectable()
export class OpenAiEmbeddingsAdapter extends EmbeddingsPort {
  private readonly logger = new Logger(OpenAiEmbeddingsAdapter.name);

  constructor(private readonly openai: OpenAiClient) {
    super();
  }

  async embed(texts: string[], opts: { dims?: number } = {}): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const res = await this.openai.run(() =>
        this.openai.raw.embeddings.create({
          model: EMBEDDING_MODEL,
          input: texts,
          ...(opts.dims ? { dimensions: opts.dims } : {}),
        }),
      );
      // Renormalize — required when `dimensions` truncates (Matryoshka).
      return res.data.map((d) => renorm(d.embedding as number[]));
    } catch (err) {
      this.logger.error(`embeddings failed: ${(err as Error).message}`);
      throw new UnavailableError('Embeddings provider unavailable', 'EmbeddingsUnavailable');
    }
  }
}
