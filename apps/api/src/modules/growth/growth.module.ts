import { Module } from '@nestjs/common';
import { GrowthController } from './growth.controller';
import { GrowthService } from './growth.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../common/clients/prisma.service';
import { RedisService } from '../../common/clients/redis.service';

@Module({
  imports: [AuthModule],
  controllers: [GrowthController],
  providers: [PrismaService, RedisService, GrowthService],
  exports: [GrowthService],
})
export class GrowthModule {}
