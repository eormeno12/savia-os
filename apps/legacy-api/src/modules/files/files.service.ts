import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import type { File } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { NotFoundError, ValidationError } from '../../common/errors/domain-error';
import { AccessService } from '../access/access.service';
import { MemoryService } from '../memory/memory.service';
import { S3Service } from './s3.service';
import { INGEST_QUEUE, IngestJobData } from '../ingest/ingest.queue';
import type { CreateFileDto, FileDto, PresignRequest } from '@savia-os/contracts';

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/json',
]);

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly access: AccessService,
    private readonly memory: MemoryService,
    @Inject(INGEST_QUEUE) private readonly ingestQueue: Queue<IngestJobData>,
  ) {}

  async presign(userId: string, dto: PresignRequest) {
    await this.access.assertCanManageSpace(userId, dto.areaId);
    if (dto.sizeBytes > MAX_BYTES) throw new ValidationError('Archivo demasiado grande (máx 20 MB)');
    if (!ALLOWED_MIMES.has(dto.mimeType)) throw new ValidationError('Tipo de archivo no permitido');
    const ext = dto.name.split('.').pop() ?? 'bin';
    const s3Key = `users/${userId}/spaces/${dto.areaId}/${randomUUID()}.${ext}`;
    const { url, fields } = await this.s3.presignUpload(s3Key, dto.mimeType, MAX_BYTES);
    return { uploadUrl: url, fields, s3Key };
  }

  async create(userId: string, dto: CreateFileDto): Promise<FileDto> {
    await this.access.assertCanManageSpace(userId, dto.areaId);
    const file = await this.prisma.file.create({
      data: {
        spaceId: dto.areaId,
        uploaderUserId: userId,
        name: dto.name,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        s3Key: dto.s3Key,
        status: 'pending',
        source: 'upload',
      },
    });
    await this.ingestQueue.add(
      'ingest',
      { fileId: file.id, userId, areaId: dto.areaId, source: 'upload' },
      { jobId: `ingest:${file.id}` },
    );
    return this.toDto(file);
  }

  async list(userId: string, areaId?: string): Promise<FileDto[]> {
    const files = await this.prisma.file.findMany({
      where: { uploaderUserId: userId, ...(areaId ? { spaceId: areaId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { memories: true } } },
    });
    return files.map((f) => this.toDto(f, f._count.memories));
  }

  async get(userId: string, id: string): Promise<FileDto> {
    const file = await this.prisma.file.findFirst({
      where: { id, uploaderUserId: userId },
      include: { _count: { select: { memories: true } } },
    });
    if (!file) throw new NotFoundError('Archivo no encontrado');
    return this.toDto(file, file._count.memories);
  }

  async delete(userId: string, id: string): Promise<void> {
    const file = await this.prisma.file.findFirst({ where: { id, uploaderUserId: userId } });
    if (!file) throw new NotFoundError('Archivo no encontrado');
    await this.memory.deleteByFile(userId, id);
    await this.s3.deleteObject(file.s3Key).catch(() => null);
    await this.prisma.file.delete({ where: { id } });
  }

  private toDto(file: File, memoryCount?: number): FileDto {
    return {
      id: file.id,
      areaId: file.spaceId,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      status: file.status,
      source: file.source,
      uploaderUserId: file.uploaderUserId,
      memoryCount,
      createdAt: file.createdAt.toISOString(),
      indexedAt: file.indexedAt?.toISOString() ?? null,
    };
  }
}
