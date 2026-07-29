import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../clients/prisma.service';
import { RedisService } from '../clients/redis.service';
import { AppConfig } from '../config/app.config';
import { OpenAiClient } from '../adapters/openai.client';
import { QdrantConnection } from '../adapters/qdrant.connection';
import { EmbeddingsPort } from '../ports/embeddings.port';
import { LlmPort } from '../ports/llm.port';
import { VectorStorePort } from '../ports/vector-store.port';
import { EntityGraphPort } from '../ports/entity-graph.port';
import { OpenAiEmbeddingsAdapter } from '../adapters/embeddings.openai.adapter';
import { OpenAiLlmAdapter } from '../adapters/llm.openai.adapter';
import { QdrantVectorStoreAdapter } from '../adapters/vector-store.qdrant.adapter';
import { Mem0EntityGraphAdapter } from '../adapters/entity-graph.mem0.adapter';

/**
 * The single global infrastructure module (F0.1 / 0A F14). It binds the domain
 * ports to their concrete adapters and exports the shared clients, so feature
 * modules never re-provision Prisma/Qdrant/OpenAI per module.
 */
@Global()
@Module({
  providers: [
    AppConfig,
    PrismaService,
    RedisService,
    OpenAiClient,
    QdrantConnection,
    { provide: EmbeddingsPort, useClass: OpenAiEmbeddingsAdapter },
    { provide: LlmPort, useClass: OpenAiLlmAdapter },
    { provide: VectorStorePort, useClass: QdrantVectorStoreAdapter },
    { provide: EntityGraphPort, useClass: Mem0EntityGraphAdapter },
  ],
  exports: [
    AppConfig,
    PrismaService,
    RedisService,
    OpenAiClient,
    QdrantConnection,
    EmbeddingsPort,
    LlmPort,
    VectorStorePort,
    EntityGraphPort,
  ],
})
export class InfraModule {}
