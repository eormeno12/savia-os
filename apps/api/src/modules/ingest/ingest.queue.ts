import { Provider } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfig } from '../../common/config/app.config';
import { bullConnection, QUEUES } from '../../common/queues/bull';

export interface IngestJobData {
  fileId: string;
  userId: string;
  areaId: string;
  source: string;
}

export const INGEST_QUEUE = 'INGEST_QUEUE';

export const ingestQueueProvider: Provider = {
  provide: INGEST_QUEUE,
  inject: [AppConfig],
  useFactory: (config: AppConfig) =>
    new Queue<IngestJobData>(QUEUES.ingest, {
      connection: bullConnection(config.redisUrl),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 }, // keep failures → the DLQ surface
      },
    }),
};
