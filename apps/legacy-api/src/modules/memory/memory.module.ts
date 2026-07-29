import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { Mem0Service } from './mem0.service';
import { CrossBoundaryReadService } from './cross-boundary-read.service';
import { KernelModule } from '../kernel/kernel.module';
import { AreasModule } from '../areas/areas.module';
import { AccessModule } from '../access/access.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [KernelModule, AreasModule, AccessModule, OrganizationModule],
  controllers: [MemoryController],
  providers: [MemoryService, Mem0Service, CrossBoundaryReadService],
  exports: [MemoryService, Mem0Service, CrossBoundaryReadService],
})
export class MemoryModule {}
