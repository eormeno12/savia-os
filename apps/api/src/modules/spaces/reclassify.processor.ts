import { Logger } from '@nestjs/common';
import { Worker, Queue, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/clients/prisma.service';
import { ClassifierService } from './classifier.service';

export const RECLASSIFY_QUEUE = 'space-backfill';

export interface ReclassifyJobData {
  spaceId: string;
  userId: string;
  newVersion: number;
}

export function createReclassifyQueue(config: ConfigService): Queue<ReclassifyJobData> {
  const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
  const url = new URL(redisUrl);
  return new Queue<ReclassifyJobData>(RECLASSIFY_QUEUE, {
    connection: { host: url.hostname, port: parseInt(url.port || '6379', 10) },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    },
  });
}

export function startReclassifyWorker(
  config: ConfigService,
  prisma: PrismaService,
  classifier: ClassifierService,
): Worker<ReclassifyJobData> {
  const logger = new Logger('ReclassifyWorker');
  const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
  const url = new URL(redisUrl);

  const worker = new Worker<ReclassifyJobData>(
    RECLASSIFY_QUEUE,
    async (job: Job<ReclassifyJobData>) => {
      const { spaceId, userId, newVersion } = job.data;
      logger.log(`backfill start spaceId=${spaceId} v${newVersion}`);

      const assigned = await classifier.backfill(spaceId, userId);

      await prisma.space.update({
        where: { id: spaceId },
        data: { reclassifying: false },
      });

      logger.log(`backfill done spaceId=${spaceId} → ${assigned} memories`);
    },
    {
      connection: { host: url.hostname, port: parseInt(url.port || '6379', 10) },
      concurrency: 1,
    },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { spaceId } = job.data;
    logger.error(`backfill failed spaceId=${spaceId}: ${err.message}`);
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await prisma.space.update({
        where: { id: spaceId },
        data: { reclassifying: false },
      }).catch(() => null);
    }
  });

  logger.log('Reclassify worker started');
  return worker;
}
