import { Module } from '@nestjs/common';
import { CollectiveController } from './collective.controller';
import { InvitesController } from './invites.controller';
import { CollectiveService } from './collective.service';
import { FederationService } from './federation.service';
import { ConnectionsModule } from '../connections/connections.module';
import { MemoryModule } from '../memory/memory.module';
import { AccessModule } from '../access/access.module';
import { AreasModule } from '../areas/areas.module';

/**
 * Collective memory = federation (08 §5). Groups + members + invites + fragments;
 * the live-union view via FederationService (fan-out + dedup).
 */
@Module({
  imports: [ConnectionsModule, MemoryModule, AccessModule, AreasModule],
  controllers: [CollectiveController, InvitesController],
  providers: [CollectiveService, FederationService],
  exports: [CollectiveService, FederationService],
})
export class CollectiveModule {}
