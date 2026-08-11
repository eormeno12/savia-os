import { Provider } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfig } from '../../common/config/app.config';
import { bullConnection, QUEUES } from '../../common/queues/bull';

export interface AccountDeleteJobData {
  dbJobId: string;
  userId: string;
}

export const ACCOUNT_DELETE_QUEUE = 'ACCOUNT_DELETE_QUEUE';

export const accountDeleteQueueProvider: Provider = {
  provide: ACCOUNT_DELETE_QUEUE,
  inject: [AppConfig],
  useFactory: (config: AppConfig) =>
    new Queue<AccountDeleteJobData>(QUEUES.accountDelete, {
      connection: bullConnection(config.redisUrl),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    }),
};
