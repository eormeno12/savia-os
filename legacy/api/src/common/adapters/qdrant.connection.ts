import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { AppConfig } from '../config/app.config';
import { CircuitBreaker } from '../resilience/circuit-breaker';

export const EMBEDDING_DIM = 1536;

/**
 * Payload keys Savia writes alongside mem0's points (namespaced `savia_*` so mem0,
 * being ADD-only, never collides). These are the indexed access/membership keys.
 */
export const PAYLOAD_KEYS = {
  areaIds: 'savia_area_ids', // keyword[] — membership (areas + ancestors) → access + map (proyección de MemoryArea)
  entities: 'savia_entities', // keyword[] — entities of the memory (mem0 links)
  sensitivity: 'savia_sensitivity', // keyword — normal | sensitive
  superseded: 'savia_superseded', // bool — consolidation
  userId: 'user_id', // keyword — mem0 provenance/partition
  fileId: 'file_id', // keyword
} as const;

const INDEXED_KEYWORD_FIELDS = [
  PAYLOAD_KEYS.areaIds,
  PAYLOAD_KEYS.entities,
  PAYLOAD_KEYS.sensitivity,
  PAYLOAD_KEYS.fileId,
] as const;

/**
 * The single `new QdrantClient()`. Owns the connection + collection lifecycle;
 * the VectorStore and EntityGraph adapters share it. (F0.1)
 *
 * Also owns the circuit breaker for Qdrant calls (same pattern as
 * `OpenAiClient.run()`) — a Qdrant outage should fail fast, not get hammered
 * on every request.
 */
@Injectable()
export class QdrantConnection implements OnModuleInit {
  private readonly logger = new Logger(QdrantConnection.name);
  private readonly breaker = new CircuitBreaker();
  readonly client: QdrantClient;
  readonly collectionName: string;
  readonly baseUrl: string;

  constructor(config: AppConfig) {
    this.baseUrl = config.qdrantUrl;
    this.collectionName = config.qdrantCollection;
    this.client = new QdrantClient({ url: this.baseUrl });
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.breaker.run(fn);
  }

  /** The entity store mem0 maintains: `{collection}_entities`. */
  get entityCollectionName(): string {
    return `${this.collectionName}_entities`;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureCollection();
  }

  async ensureCollection(): Promise<void> {
    try {
      await this.client.createCollection(this.collectionName, {
        vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
      });
      this.logger.log(`Created Qdrant collection "${this.collectionName}"`);
    } catch (err) {
      if ((err as { status?: number })?.status !== 409) throw err;
    }

    for (const field of INDEXED_KEYWORD_FIELDS) {
      try {
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: field,
          field_schema: 'keyword',
        });
      } catch {
        // index already exists — idempotent
      }
    }
    try {
      // is_tenant: co-locates each user's points on the same disk segment —
      // Qdrant's own recommendation for many small tenants sharing one
      // collection (Savia's shape), vs. a collection-per-tenant. Performance
      // only; the access boundary is still the `user_id` filter itself.
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: PAYLOAD_KEYS.userId,
        field_schema: { type: 'keyword', is_tenant: true },
      });
    } catch {
      // idempotent
    }
    try {
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: PAYLOAD_KEYS.superseded,
        field_schema: 'bool',
      });
    } catch {
      // idempotent
    }
  }
}
