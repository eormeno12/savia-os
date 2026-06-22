import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { S3Service } from './s3.service';
import { PrismaService } from '../../common/clients/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [AuthModule, MemoryModule],
  controllers: [FilesController],
  providers: [FilesService, S3Service, PrismaService],
  exports: [FilesService],
})
export class FilesModule {}
