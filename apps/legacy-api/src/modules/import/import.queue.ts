import { Provider } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfig } from '../../common/config/app.config';
import { bullConnection, QUEUES } from '../../common/queues/bull';

export interface ImportJobData {
  dbJobId: string;
  userId: string;
  chunks: string[];
  source: string;
}

export const IMPORT_QUEUE = 'IMPORT_QUEUE';

export const importQueueProvider: Provider = {
  provide: IMPORT_QUEUE,
  inject: [AppConfig],
  useFactory: (config: AppConfig) =>
    new Queue<ImportJobData>(QUEUES.import, {
      connection: bullConnection(config.redisUrl),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    }),
};
