import { Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AppConfig } from '../../common/config/app.config';
import { bullConnection, QUEUES } from '../../common/queues/bull';
import { JobsService } from '../jobs/jobs.service';
import { JobsModule } from '../jobs/jobs.module';
import { AccountModule, AccountService } from './account.module';
import { AccountDeleteJobData } from './account.queue';

/**
 * Account delete worker (worker process). Reuses AccountService.delete() as-is
 * — the multi-store purge logic doesn't change, only when it runs. Progress
 * lands on the Job row for the Bandeja; terminal failure → DLQ + Job marked
 * failed. Closes cleanly on SIGTERM.
 */
@Injectable()
export class AccountDeleteWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountDeleteWorker.name);
  private worker?: Worker<AccountDeleteJobData>;

  constructor(
    private readonly config: AppConfig,
    private readonly account: AccountService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<AccountDeleteJobData>(QUEUES.accountDelete, (job) => this.process(job), {
      connection: bullConnection(this.config.redisUrl),
      concurrency: 1,
    });
    this.worker.on('failed', async (job, err) => {
      if (job) await this.jobs.update(job.data.dbJobId, { status: 'failed', error: err.message.slice(0, 500) }).catch(() => null);
    });
    this.logger.log('Account delete worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<AccountDeleteJobData>): Promise<void> {
    const { dbJobId, userId } = job.data;
    await this.jobs.update(dbJobId, { status: 'running' });
    await this.account.delete(userId);
    // Job.userId -> User is onDelete:Cascade, so a successful delete() just
    // deleted this very Job row along with everything else — this update
    // racing "the row no longer exists" IS the success signal, not a failure.
    // Must not throw here: an uncaught rejection would make BullMQ retry an
    // already-completed deletion against a user that no longer exists.
    await this.jobs.update(dbJobId, { status: 'done', progress: 100 }).catch(() => null);
    this.logger.log(`account ${userId} delete job ${dbJobId} done`);
  }
}

@Module({
  imports: [AccountModule, JobsModule],
  providers: [AccountDeleteWorker],
  exports: [AccountDeleteWorker],
})
export class AccountWorkerModule {}
