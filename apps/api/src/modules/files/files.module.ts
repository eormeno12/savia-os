import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { S3Service } from './s3.service';
import { ingestQueueProvider } from '../ingest/ingest.queue';
import { MemoryModule } from '../memory/memory.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [MemoryModule, AccessModule],
  controllers: [FilesController],
  providers: [FilesService, S3Service, ingestQueueProvider],
  exports: [S3Service],
})
export class FilesModule {}
