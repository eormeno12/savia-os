import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/clients/prisma.service';
import { ClassifierService } from './classifier.service';
import { RECLASSIFY_QUEUE, ReclassifyJobData } from './reclassify.processor';
import type { CreateSpaceDto, UpdateSpaceDto, SpaceDto, SpaceMemoryDto } from '@savia-os/contracts';

export const RECLASSIFY_QUEUE_TOKEN = 'RECLASSIFY_QUEUE';

@Injectable()
export class SpacesService {
  private readonly logger = new Logger(SpacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly classifier: ClassifierService,
    @Inject(RECLASSIFY_QUEUE_TOKEN) private readonly reclassifyQueue: Queue<ReclassifyJobData>,
  ) {}

  async create(userId: string, dto: CreateSpaceDto): Promise<SpaceDto> {
    // LLM infers a short name from the description
    const name = await this.inferName(dto.description);

    // Embed description for future cosine comparisons
    const descriptionEmbedding = await this.classifier.embed(dto.description);

    let space: Awaited<ReturnType<PrismaService['space']['create']>>;
    try {
      space = await this.prisma.space.create({
        data: {
          userId,
          name,
          description: dto.description,
          descriptionEmbedding,
          version: 1,
          reclassifying: true,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(`Ya existe un space llamado "${name}"`);
      }
      throw err;
    }

    // Enqueue backfill job
    await this.reclassifyQueue.add(RECLASSIFY_QUEUE, {
      spaceId: space.id,
      userId,
      newVersion: 1,
    });

    return this.toDto(space, 0);
  }

  async findAll(userId: string): Promise<SpaceDto[]> {
    const spaces = await this.prisma.space.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      spaces.map(async (s) => {
        const count = await this.prisma.memoryIndex.count({
          where: { userId, spaceIds: { has: s.id } },
        });
        return this.toDto(s, count);
      }),
    );
  }

  async update(userId: string, spaceId: string, dto: UpdateSpaceDto): Promise<SpaceDto> {
    const space = await this.prisma.space.findFirst({ where: { id: spaceId, userId } });
    if (!space) throw new NotFoundException('Space no encontrado');

    const descriptionChanged = dto.description !== undefined && dto.description !== space.description;
    let newEmbedding = space.descriptionEmbedding as number[];
    let newVersion = space.version;

    if (descriptionChanged) {
      newEmbedding = await this.classifier.embed(dto.description!);
      newVersion = space.version + 1;
    }

    let newName = dto.name ?? space.name;
    if (descriptionChanged && !dto.name) {
      newName = await this.inferName(dto.description!);
    }

    const updated = await this.prisma.space.update({
      where: { id: spaceId },
      data: {
        description: dto.description ?? space.description,
        name: newName,
        descriptionEmbedding: newEmbedding,
        version: newVersion,
        reclassifying: descriptionChanged ? true : space.reclassifying,
      },
    });

    if (descriptionChanged) {
      await this.reclassifyQueue.add(RECLASSIFY_QUEUE, {
        spaceId,
        userId,
        newVersion,
      });
    }

    const count = await this.prisma.memoryIndex.count({
      where: { userId, spaceIds: { has: spaceId } },
    });
    return this.toDto(updated, count);
  }

  async remove(userId: string, spaceId: string): Promise<void> {
    const space = await this.prisma.space.findFirst({ where: { id: spaceId, userId } });
    if (!space) throw new NotFoundException('Space no encontrado');

    // Remove space tag from all MemoryIndex rows
    const rows = await this.prisma.memoryIndex.findMany({
      where: { userId, spaceIds: { has: spaceId } },
    });
    for (const row of rows) {
      const newIds = (row.spaceIds as string[]).filter((id) => id !== spaceId);
      const versions = (row.spaceVersions as Record<string, number>) ?? {};
      delete versions[spaceId];
      await this.prisma.memoryIndex.update({
        where: { memoryId: row.memoryId },
        data: { spaceIds: newIds, spaceVersions: versions },
      });
    }

    // Cascade on grants is handled by Prisma onDelete: Cascade
    await this.prisma.space.delete({ where: { id: spaceId } });
  }

  async getMemories(
    userId: string,
    spaceId: string,
    cursor?: string,
    limit = 20,
  ): Promise<SpaceMemoryDto[]> {
    const space = await this.prisma.space.findFirst({ where: { id: spaceId, userId } });
    if (!space) throw new NotFoundException('Space no encontrado');

    const allSpaces = await this.prisma.space.findMany({
      where: { userId },
      select: { id: true, name: true },
    });

    const rows = await this.prisma.memoryIndex.findMany({
      where: { userId, spaceIds: { has: spaceId } },
      take: limit,
      ...(cursor ? { cursor: { memoryId: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => {
      const otherSpaceIds = (row.spaceIds as string[]).filter((id) => id !== spaceId);
      const otherSpaces = otherSpaceIds
        .map((id) => allSpaces.find((s) => s.id === id))
        .filter((s): s is { id: string; name: string } => Boolean(s));

      return {
        memoryId: row.memoryId,
        text: '',
        manualOverride: row.manualOverride,
        otherSpaces,
      } satisfies SpaceMemoryDto;
    });
  }

  async removeMemoryFromSpace(userId: string, spaceId: string, memoryId: string): Promise<void> {
    const row = await this.prisma.memoryIndex.findFirst({
      where: { memoryId, userId, spaceIds: { has: spaceId } },
    });
    if (!row) throw new NotFoundException('Memoria no encontrada en este space');

    const newIds = (row.spaceIds as string[]).filter((id) => id !== spaceId);
    const versions = (row.spaceVersions as Record<string, number>) ?? {};
    delete versions[spaceId];

    await this.prisma.memoryIndex.update({
      where: { memoryId },
      data: { spaceIds: newIds, spaceVersions: versions, manualOverride: true },
    });
  }

  async addMemoryToSpace(userId: string, spaceId: string, memoryId: string): Promise<void> {
    const space = await this.prisma.space.findFirst({ where: { id: spaceId, userId } });
    if (!space) throw new NotFoundException('Space no encontrado');

    const row = await this.prisma.memoryIndex.findFirst({ where: { memoryId, userId } });
    if (!row) throw new NotFoundException('Memoria no encontrada');

    const newIds = Array.from(new Set([...(row.spaceIds as string[]), spaceId]));
    const versions = (row.spaceVersions as Record<string, number>) ?? {};
    versions[spaceId] = space.version;

    await this.prisma.memoryIndex.update({
      where: { memoryId },
      data: { spaceIds: newIds, spaceVersions: versions, manualOverride: true },
    });
  }

  private async inferName(description: string): Promise<string> {
    const { default: OpenAI } = await import('openai');
    const { ConfigService } = await import('@nestjs/config');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content:
            `Dado este texto que describe un espacio de memoria, sugiere un nombre corto (1-3 palabras, en español, sin comillas):\n"${description}"`,
        },
      ],
      max_tokens: 15,
      temperature: 0.3,
    });
    return (res.choices[0]?.message?.content?.trim() ?? 'Sin nombre').slice(0, 50);
  }

  private toDto(space: any, memoryCount: number): SpaceDto {
    return {
      id: space.id,
      name: space.name,
      description: space.description,
      version: space.version,
      memoryCount,
      reclassifying: space.reclassifying,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString(),
    };
  }
}
