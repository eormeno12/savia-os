import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const EMBEDDING_DIM = 1536;

@Injectable()
export class QdrantService extends QdrantClient implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  readonly baseUrl: string;
  readonly collectionName: string;

  constructor(private readonly config: ConfigService) {
    const url = config.get<string>('QDRANT_URL', 'http://localhost:6333');
    super({ url });
    this.baseUrl = url;
    this.collectionName = config.get<string>('QDRANT_COLLECTION', 'savia_memories');
  }

  async onModuleInit() {
    await this.ensureCollection();
  }

  async ensureCollection(): Promise<void> {
    try {
      await this.createCollection(this.collectionName, {
        vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
      });
      this.logger.log(`Created Qdrant collection "${this.collectionName}"`);
    } catch (err: any) {
      if (err?.status !== 409) throw err;
      // Collection already exists — idempotent
    }

    // Create payload indices for fast filtering
    for (const field of ['user_id', 'submemories', 'file_id']) {
      try {
        await this.createPayloadIndex(this.collectionName, {
          field_name: field,
          field_schema: 'keyword',
        });
      } catch {
        // Index may already exist
      }
    }
  }

  async searchVectors(
    vector: number[],
    filter: Record<string, unknown>,
    limit = 10,
  ) {
    return this.search(this.collectionName, {
      vector,
      filter: filter as any,
      limit,
      with_payload: true,
    });
  }

  async deleteByFilter(filter: Record<string, unknown>): Promise<void> {
    await this.delete(this.collectionName, { filter: filter as any });
  }

  async deletePoint(id: string): Promise<void> {
    await this.delete(this.collectionName, { points: [id] });
  }
}
