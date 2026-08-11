import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';

// Deps (Prisma/Redis/Qdrant) come from the global InfraModule.
@Module({
  controllers: [HealthController, MetricsController],
})
export class HealthModule {}
