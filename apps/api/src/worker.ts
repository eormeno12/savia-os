import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from './common/clients/prisma.service';
import { QdrantService } from './common/clients/qdrant.service';
import { MemoryModule } from './modules/memory/memory.module';
import { MemoryService } from './modules/memory/memory.service';
import { startIngestWorker } from './modules/ingest/ingest.processor';
import { ClassifierService } from './modules/spaces/classifier.service';
import { startReclassifyWorker } from './modules/spaces/reclassify.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MemoryModule,
  ],
  providers: [PrismaService, QdrantService, ClassifierService],
})
class WorkerAppModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const config = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const memoryService = app.get(MemoryService);
  const classifierService = app.get(ClassifierService);

  startIngestWorker(config, prismaService, memoryService, classifierService);
  startReclassifyWorker(config, prismaService, classifierService);

  console.log('[worker] Savia ingest + reclassify workers running');

  // keep process alive
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap();
