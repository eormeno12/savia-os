import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { ClusterService } from './cluster.service';
import { MemoryModule } from '../memory/memory.module';
import { AuthModule } from '../auth/auth.module';
import { QdrantService } from '../../common/clients/qdrant.service';
import { PrismaService } from '../../common/clients/prisma.service';

@Module({
  imports: [AuthModule, MemoryModule],
  controllers: [OnboardingController],
  providers: [PrismaService, QdrantService, ClusterService, OnboardingService],
})
export class OnboardingModule {}
