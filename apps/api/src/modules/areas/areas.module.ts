import { Module } from '@nestjs/common';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { KernelModule } from '../kernel/kernel.module';
import { AccessModule } from '../access/access.module';

/**
 * The area tree (Space). Ports (llm/vector) come from the global InfraModule.
 */
@Module({
  imports: [KernelModule, AccessModule],
  controllers: [AreasController],
  providers: [AreasService],
  exports: [AreasService],
})
export class AreasModule {}
