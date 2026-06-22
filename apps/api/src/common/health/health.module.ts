import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisService } from '../clients/redis.service';
import { QdrantService } from '../clients/qdrant.service';

@Module({
  controllers: [HealthController],
  providers: [RedisService, QdrantService],
  exports: [RedisService, QdrantService],
})
export class HealthModule {}
