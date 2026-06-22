import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisService } from '../clients/redis.service';
import { QdrantService } from '../clients/qdrant.service';
import { PrismaService } from '../clients/prisma.service';

@Module({
  controllers: [HealthController],
  providers: [RedisService, QdrantService, PrismaService],
  exports: [RedisService, QdrantService, PrismaService],
})
export class HealthModule {}
