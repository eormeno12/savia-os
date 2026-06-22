import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from './common/clients/prisma.service';
import { QdrantService } from './common/clients/qdrant.service';
import { MemoryModule } from './modules/memory/memory.module';
import { MemoryService } from './modules/memory/memory.service';
import { startIngestWorker } from './modules/ingest/ingest.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MemoryModule,
  ],
  providers: [PrismaService, QdrantService],
})
class WorkerAppModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const config = app.get(ConfigService);
  const prismaService = app.get(PrismaService);
  const memoryService = app.get(MemoryService);

  startIngestWorker(config, prismaService, memoryService);

  console.log('[worker] Savia ingest worker running');

  // keep process alive
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap();
