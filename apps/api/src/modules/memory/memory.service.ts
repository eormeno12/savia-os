import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../common/clients/prisma.service';
import { QdrantService } from '../../common/clients/qdrant.service';
import { buildMem0Config } from './mem0.config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Memory } = require('mem0ai/oss') as { Memory: any };

const EMBEDDING_MODEL = 'text-embedding-3-small';

interface AddMeta {
  fileId?: string;
  source?: string;
  [key: string]: unknown;
}

export interface MemoryResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class MemoryService implements OnModuleInit {
  private readonly logger = new Logger(MemoryService.name);
  private mem0: any;
  private openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly qdrant: QdrantService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const apiKey = this.config.get<string>('OPENAI_API_KEY', '');
    this.openai = new OpenAI({ apiKey });

    this.mem0 = new Memory(
      buildMem0Config({
        qdrantUrl: this.qdrant.baseUrl,
        collectionName: this.qdrant.collectionName,
        openAiApiKey: apiKey,
      }),
    );
  }

  async add(
    userId: string,
    text: string,
    meta: AddMeta = {},
  ): Promise<string[]> {
    const result = await this.mem0.add(text, {
      userId,
      metadata: {
        file_id: meta.fileId ?? null,
        source: meta.source ?? 'manual',
        submemories: [],
        savia_version: 1,
      },
    });

    const memoryIds: string[] = (result?.results ?? []).map((r: any) => String(r.id));

    if (memoryIds.length > 0) {
      await this.prisma.memoryIndex.createMany({
        data: memoryIds.map((memoryId) => ({
          memoryId,
          userId,
          fileId: meta.fileId ?? null,
          source: meta.source ?? 'manual',
          spaceIds: [],
          spaceVersions: {},
        })),
        skipDuplicates: true,
      });

      // Emit growth events (one per memory, spaceId filled later by classifier)
      await this.prisma.growthEvent.createMany({
        data: memoryIds.map((memoryId) => ({ userId, memoryId })),
      }).catch(() => null);
    }

    this.logger.log(`add userId=${userId} → ${memoryIds.length} memories`);
    return memoryIds;
  }

  async search(
    userId: string,
    query: string,
    opts: { submemories?: string[]; limit?: number } = {},
  ): Promise<MemoryResult[]> {
    const { limit = 10, submemories } = opts;

    const embeddingRes = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    });
    const vector = embeddingRes.data[0].embedding;

    const must: any[] = [{ key: 'user_id', match: { value: userId } }];
    if (submemories?.length) {
      must.push({ key: 'submemories', match: { any: submemories } });
    }

    const hits = await this.qdrant.searchVectors(vector, { must }, limit);

    return hits.map((hit) => ({
      id: String(hit.id),
      text: String((hit.payload as any)?.data ?? ''),
      score: hit.score,
      metadata: (hit.payload as Record<string, unknown>) ?? {},
    }));
  }

  async deleteByFile(fileId: string): Promise<void> {
    await this.qdrant.deleteByFilter({
      must: [{ key: 'file_id', match: { value: fileId } }],
    });
    await this.prisma.memoryIndex.deleteMany({ where: { fileId } });
    this.logger.log(`deleteByFile fileId=${fileId}`);
  }

  async deleteByMemoryId(memoryId: string): Promise<void> {
    await this.qdrant.deletePoint(memoryId);
    await this.prisma.memoryIndex.deleteMany({ where: { memoryId } });
  }
}
