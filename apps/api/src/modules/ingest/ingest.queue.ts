import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

export const INGEST_QUEUE = 'ingest';

export interface IngestJobData {
  fileId: string;
  userId: string;
  source: string;
}

export function createIngestQueue(config: ConfigService): Queue<IngestJobData> {
  const redisUrl = config.get<string>('REDIS_URL', 'redis://localhost:6379');
  const url = new URL(redisUrl);
  return new Queue<IngestJobData>(INGEST_QUEUE, {
    connection: {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });
}

export const INGEST_QUEUE_TOKEN = 'INGEST_QUEUE';
