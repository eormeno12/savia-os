import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { AppConfig } from '../../common/config/app.config';
import { bullConnection, QUEUES } from '../../common/queues/bull';
import { MemoryService } from '../memory/memory.service';
import { JobsService } from '../jobs/jobs.service';
import { ImportJobData } from './import.queue';

/**
 * ChatGPT import worker (worker process). Routes each conversation through the
 * normal memory.add path (so imports get the same clustering). Progress lands on
 * the Job row for the Bandeja; terminal failure → DLQ + Job marked failed.
 * Closes cleanly on SIGTERM.
 */
@Injectable()
export class ImportWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportWorker.name);
  private worker?: Worker<ImportJobData>;

  constructor(
    private readonly config: AppConfig,
    private readonly memory: MemoryService,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<ImportJobData>(QUEUES.import, (job) => this.process(job), {
      connection: bullConnection(this.config.redisUrl),
      concurrency: 1,
    });
    this.worker.on('failed', async (job, err) => {
      if (job) await this.jobs.update(job.data.dbJobId, { status: 'failed', error: err.message.slice(0, 500) }).catch(() => null);
    });
    this.logger.log('Import worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<ImportJobData>): Promise<void> {
    const { dbJobId, userId, chunks } = job.data;
    await this.jobs.update(dbJobId, { status: 'running' });
    let done = 0;
    let failed = 0;
    for (const chunk of chunks) {
      await this.memory
        .add(userId, chunk, { source: 'import_chatgpt', sourceRef: dbJobId, sourceLabel: 'Import ChatGPT' })
        .catch((e) => {
          failed++;
          this.logger.warn(`chunk failed: ${e.message}`);
        });
      done++;
      await this.jobs.update(dbJobId, { progress: Math.round((done / Math.max(1, chunks.length)) * 100) });
    }
    if (failed === chunks.length && chunks.length > 0) {
      await this.jobs.update(dbJobId, { status: 'failed', progress: 100, error: `las ${chunks.length} conversaciones fallaron` });
    } else {
      await this.jobs.update(dbJobId, {
        status: 'done',
        progress: 100,
        error: failed > 0 ? `${failed}/${chunks.length} conversaciones fallaron` : null,
      });
    }
    this.logger.log(`import ${dbJobId} done (${chunks.length} conversations, ${failed} failed)`);
  }
}
