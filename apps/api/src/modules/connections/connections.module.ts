import { Module } from '@nestjs/common';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { TokenService } from './token.service';
import { GrantsCache } from './grants.cache';
import { AccessModule } from '../access/access.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AccessModule, BillingModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService, TokenService, GrantsCache],
  exports: [ConnectionsService, TokenService, GrantsCache],
})
export class ConnectionsModule {}
