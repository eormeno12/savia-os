import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Memory } from 'mem0ai/oss';
import { AppConfig } from '../../common/config/app.config';
import { QdrantConnection } from '../../common/adapters/qdrant.connection';
import { UnavailableError } from '../../common/errors/domain-error';
import { buildMem0Config } from './mem0.config';

export interface AddedFact { id: string; text: string }
export interface SearchCandidate { id: string; text: string; score: number }

/**
 * The mem0 edge (08 §3). The ONLY place mem0 is touched — `add` (extraction +
 * dedup, ADD-only) and `search` (dense + BM25 + entities + rerank). Everything
 * else (areas, access, payload) is Savia's, layered over the same Qdrant.
 */
@Injectable()
export class Mem0Service implements OnModuleInit {
  private readonly logger = new Logger(Mem0Service.name);
  private mem0!: Memory;

  constructor(
    private readonly config: AppConfig,
    private readonly qdrant: QdrantConnection,
  ) {}

  onModuleInit(): void {
    this.mem0 = new Memory(
      buildMem0Config({
        qdrantUrl: this.qdrant.baseUrl,
        collectionName: this.qdrant.collectionName,
        openAiApiKey: this.config.openaiApiKey,
      }),
    );
  }

  /** Extract + store facts. Returns ONLY genuinely-added facts (dedup → skipped). */
  async add(userId: string, text: string, metadata: Record<string, unknown> = {}): Promise<AddedFact[]> {
    let result: Awaited<ReturnType<Memory['add']>>;
    try {
      result = await this.mem0.add(text, { userId, metadata });
    } catch (err) {
      this.logger.error(`mem0.add failed: ${(err as Error).message}`);
      throw new UnavailableError('Memoria no disponible', 'Mem0Unavailable');
    }
    return result.results
      .filter((r) => !r.metadata?.event || String(r.metadata.event).toUpperCase() === 'ADD')
      .map((r) => ({ id: r.id, text: r.memory ?? text }));
  }

  /** Hybrid candidates over the user's partition. Access filtering happens after. */
  async searchCandidates(userId: string, query: string, limit: number): Promise<SearchCandidate[]> {
    try {
      const res = await this.mem0.search(query, { filters: { user_id: userId }, topK: limit });
      return res.results.map((r) => ({
        id: r.id,
        text: r.memory ?? '',
        score: r.score ?? 0,
      }));
    } catch (err) {
      this.logger.error(`mem0.search failed: ${(err as Error).message}`);
      throw new UnavailableError('Búsqueda no disponible', 'SearchUnavailable');
    }
  }
}
