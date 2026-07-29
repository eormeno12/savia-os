import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { validateEnv } from './common/config/env.schema';
import { LoggingModule } from './common/logging/logging.module';
import { InfraModule } from './common/infra/infra.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { EngineWorker } from './modules/organization/engine.worker';
import { MemoryModule } from './modules/memory/memory.module';
import { FilesModule } from './modules/files/files.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { IngestWorker } from './modules/ingest/ingest.worker';
import { ImportWorker } from './modules/import/import.worker';
import { RetentionWorker } from './modules/retention/retention.worker';
import { AccountWorkerModule } from './modules/account/account.worker';

/**
 * Background worker process. Runs the reconciliation timers (outbox relay +
 * vector GC) and the v2 dynamic engine (EngineWorker: drains the persona-graph /
 * encoding-tree work queue). Shares the validated config + infra with the API.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    LoggingModule,
    InfraModule,
    OutboxModule,
    OrganizationModule,
    MemoryModule,
    FilesModule,
    JobsModule,
    AccountWorkerModule,
  ],
  providers: [EngineWorker, IngestWorker, ImportWorker, RetentionWorker],
})
class WorkerModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.get(Logger).log('Savia worker running (outbox relay + vector GC + dynamic engine)');
}

void bootstrap();
