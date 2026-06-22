import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { PrismaService } from '../../common/clients/prisma.service';
import { QdrantService } from '../../common/clients/qdrant.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MemoryController],
  providers: [MemoryService, PrismaService, QdrantService],
  exports: [MemoryService],
})
export class MemoryModule {}
