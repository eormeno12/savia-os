import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INGEST_QUEUE_TOKEN, createIngestQueue } from './ingest.queue';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [MemoryModule],
  providers: [
    {
      provide: INGEST_QUEUE_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createIngestQueue(config),
    },
  ],
  exports: [INGEST_QUEUE_TOKEN],
})
export class IngestModule {}
