import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpacesController } from './spaces.controller';
import { SpacesService, RECLASSIFY_QUEUE_TOKEN } from './spaces.service';
import { ClassifierService } from './classifier.service';
import { createReclassifyQueue } from './reclassify.processor';
import { PrismaService } from '../../common/clients/prisma.service';
import { QdrantService } from '../../common/clients/qdrant.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SpacesController],
  providers: [
    PrismaService,
    QdrantService,
    ClassifierService,
    SpacesService,
    {
      provide: RECLASSIFY_QUEUE_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createReclassifyQueue(config),
    },
  ],
  exports: [ClassifierService],
})
export class SpacesModule {}
