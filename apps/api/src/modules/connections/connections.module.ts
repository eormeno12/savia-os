import { Module } from '@nestjs/common';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { TokenService } from './token.service';
import { GrantsCache } from './grants.cache';
import { PrismaService } from '../../common/clients/prisma.service';
import { RedisService } from '../../common/clients/redis.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ConnectionsController],
  providers: [PrismaService, RedisService, TokenService, GrantsCache, ConnectionsService],
  exports: [ConnectionsService, GrantsCache],
})
export class ConnectionsModule {}
