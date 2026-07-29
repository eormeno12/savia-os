import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AppConfig } from '../../common/config/app.config';
import { PrismaService } from '../../common/clients/prisma.service';
import { bullConnection, QUEUES } from '../../common/queues/bull';
import { MemoryService } from '../memory/memory.service';
import { S3Service } from '../files/s3.service';
import { parseFile } from './parsers';
import { chunkText } from './chunk';
import { IngestJobData } from './ingest.queue';

/**
 * File → memory pipeline (worker process). Idempotent: jobId is `ingest:<fileId>`
 * and the worker clears prior memories on retry (02-INT-2). Terminal failures land
 * in BullMQ's failed set (DLQ) and mark the file `failed`. Closes cleanly on
 * SIGTERM via OnModuleDestroy (02-INT-1).
 */
@Injectable()
export class IngestWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestWorker.name);
  private worker?: Worker<IngestJobData>;

  constructor(
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly memory: MemoryService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<IngestJobData>(QUEUES.ingest, (job) => this.process(job), {
      connection: bullConnection(this.config.redisUrl),
      concurrency: 2,
    });
    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      this.logger.warn(`[${job.data.fileId}] attempt ${job.attemptsMade} failed: ${err.message}`);
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await this.prisma.file
          .update({ where: { id: job.data.fileId }, data: { status: 'failed', error: err.message.slice(0, 500) } })
          .catch(() => null);
      }
    });
    this.logger.log('Ingest worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<IngestJobData>): Promise<void> {
    const { fileId, userId, areaId } = job.data;
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) return;

    await this.prisma.file.update({ where: { id: fileId }, data: { status: 'processing' } });
    await this.memory.deleteByFile(userId, fileId); // idempotent on retry

    const buffer = this.s3.enabled
      ? await this.s3.download(file.s3Key)
      : Buffer.from(`[dev] contenido simulado para ${file.name}`);

    const chunks = chunkText(await parseFile(buffer, file.mimeType));
    let count = 0;
    for (let i = 0; i < chunks.length; i++) {
      await job.updateProgress(Math.round((i / Math.max(1, chunks.length)) * 90));
      const ids = await this.memory.add(userId, chunks[i], {
        source: 'file',
        areaId,
        fileId, // FK tipada → File.memoryCount, deleteByFile, cascada (arregla el bug previo)
        sourceLabel: file.name, // snapshot legible para el Pulso
      });
      count += ids.length;
    }

    await this.prisma.file.update({
      where: { id: fileId },
      data: { status: 'indexed', indexedAt: new Date(), error: null },
    });
    this.logger.log(`[${fileId}] indexed ${count} memories from ${chunks.length} chunks`);
  }
}
