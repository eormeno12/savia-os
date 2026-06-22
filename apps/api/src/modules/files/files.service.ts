import {
  Injectable,
  Inject,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/clients/prisma.service';
import { S3Service } from './s3.service';
import { MemoryService } from '../memory/memory.service';
import { INGEST_QUEUE_TOKEN, IngestJobData } from '../ingest/ingest.queue';

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
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
    private readonly memoryService: MemoryService,
    @Inject(INGEST_QUEUE_TOKEN) private readonly ingestQueue: Queue<IngestJobData>,
  ) {}

  async presign(userId: string, name: string, mimeType: string, sizeBytes: number) {
    if (sizeBytes > MAX_BYTES) throw new PayloadTooLargeException('Archivo demasiado grande (máx 20 MB).');
    if (!ALLOWED_MIMES.has(mimeType)) throw new UnsupportedMediaTypeException('Tipo de archivo no permitido.');

    const ext = name.split('.').pop() ?? 'bin';
    const s3Key = `users/${userId}/${randomUUID()}.${ext}`;
    const { url, fields } = await this.s3.presignUpload(s3Key, mimeType, MAX_BYTES);
    return { uploadUrl: url, fields, s3Key };
  }

  async create(userId: string, name: string, mimeType: string, sizeBytes: number, s3Key: string) {
    const file = await this.prisma.file.create({
      data: { userId, name, mimeType, sizeBytes, s3Key, status: 'pending', source: 'upload' },
    });
    await this.ingestQueue.add('ingest', { fileId: file.id, userId, source: 'upload' });
    return file;
  }

  async list(userId: string) {
    const files = await this.prisma.file.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { memories: true } } },
    });

    return files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      status: f.status,
      source: f.source,
      memoryCount: f._count.memories,
      createdAt: f.createdAt.toISOString(),
      indexedAt: f.indexedAt?.toISOString() ?? null,
    }));
  }

  async get(userId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, userId },
      include: { _count: { select: { memories: true } } },
    });
    if (!file) throw new NotFoundException('Archivo no encontrado.');

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      status: file.status,
      source: file.source,
      memoryCount: file._count.memories,
      createdAt: file.createdAt.toISOString(),
      indexedAt: file.indexedAt?.toISOString() ?? null,
    };
  }

  async delete(userId: string, fileId: string): Promise<void> {
    const file = await this.prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new NotFoundException('Archivo no encontrado.');

    await this.memoryService.deleteByFile(fileId);
    if (this.s3.bucket) await this.s3.deleteObject(file.s3Key);
    await this.prisma.file.delete({ where: { id: fileId } });
  }
}
