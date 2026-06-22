import { Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { MemoryService } from '../memory/memory.service';
import { parseFile } from './parsers';
import { chunkText } from './chunk';
import { INGEST_QUEUE, IngestJobData } from './ingest.queue';

async function s3StreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function startIngestWorker(
  config: ConfigService,
  prisma: PrismaClient,
  memoryService: MemoryService,
): Worker<IngestJobData> {
  const logger = new Logger('IngestWorker');
  const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
  const url = new URL(redisUrl);

  const s3 = new S3Client({ region: config.get<string>('AWS_REGION', 'us-east-1') });
  const bucket = config.get<string>('AWS_S3_BUCKET', '');

  const worker = new Worker<IngestJobData>(
    INGEST_QUEUE,
    async (job: Job<IngestJobData>) => {
      const { fileId, userId, source } = job.data;
      const t0 = Date.now();
      logger.log(`[${fileId}] start source=${source}`);

      const file = await prisma.file.findUnique({ where: { id: fileId } });
      if (!file) {
        logger.warn(`[${fileId}] file not found, skipping`);
        return;
      }

      // Mark processing
      await prisma.file.update({ where: { id: fileId }, data: { status: 'processing' } });

      // Idempotence: clear previous memories on retry
      await memoryService.deleteByFile(fileId);

      // Download from S3 (skip if no bucket in dev)
      let buffer: Buffer;
      if (bucket) {
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: file.s3Key }));
        buffer = await s3StreamToBuffer(obj.Body as NodeJS.ReadableStream);
      } else {
        // Dev fallback: use s3Key as a local path or empty text
        const fs = await import('fs/promises');
        try {
          buffer = await fs.readFile(file.s3Key);
        } catch {
          buffer = Buffer.from(`[dev] contenido simulado para ${file.name}`);
        }
      }

      // Parse
      const rawText = await parseFile(buffer, file.mimeType);
      const chunks = chunkText(rawText);
      logger.log(`[${fileId}] parsed → ${chunks.length} chunks`);

      // Ingest chunks
      let memoryCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        await job.updateProgress(Math.round((i / chunks.length) * 90));
        const ids = await memoryService.add(userId, chunks[i], { fileId, source });
        memoryCount += ids.length;

        // Emit growth events (one per extracted memory; spaceId assigned in step 07)
        if (ids.length > 0) {
          await prisma.growthEvent.createMany({
            data: ids.map((memoryId) => ({ userId, memoryId })),
            skipDuplicates: true,
          });
        }
      }

      // Mark indexed
      await prisma.file.update({
        where: { id: fileId },
        data: { status: 'indexed', indexedAt: new Date(), error: null },
      });

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      logger.log(`[${fileId}] indexed ${memoryCount} memories in ${elapsed}s`);
    },
    {
      connection: { host: url.hostname, port: parseInt(url.port || '6379', 10) },
      concurrency: 2,
    },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { fileId } = job.data;
    logger.error(`[${fileId}] failed attempt ${job.attemptsMade}: ${err.message}`);
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await prisma.file.update({
        where: { id: fileId },
        data: { status: 'failed', error: err.message.slice(0, 500) },
      }).catch(() => null);
    }
  });

  logger.log('Ingest worker started');
  return worker;
}
