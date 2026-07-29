import { Module } from '@nestjs/common';
import { KernelModule } from '../kernel/kernel.module';
import { AreasModule } from '../areas/areas.module';
import { NamingService } from './naming.service';
import { SuggestionsService } from './suggestions.service';
import { MemoryGraphService } from './memory-graph.service';
import { EngineTasksService } from './engine-tasks.service';
import { PersonaService } from './persona.service';
import { StructureExecutorService } from './structure-executor.service';
import { CommunityService } from './community.service';
import { TreeBuilderService } from './tree-builder.service';
import { EnginePlacementService } from './engine-placement.service';
import { EngineBootstrapService } from './bootstrap/engine-bootstrap.service';

/**
 * The dynamic memory engine v2 (persona graph + encoding tree), driven by the
 * EngineWorker in the worker process. NamingService names areas; SuggestionsService
 * surfaces structural changes in the inbox. Ports (vector/entity-graph) come from
 * the global InfraModule.
 */
@Module({
  imports: [KernelModule, AreasModule],
  providers: [
    NamingService,
    SuggestionsService,
    MemoryGraphService,
    EngineTasksService,
    PersonaService,
    StructureExecutorService,
    CommunityService,
    TreeBuilderService,
    EnginePlacementService,
    EngineBootstrapService,
  ],
  exports: [
    SuggestionsService,
    MemoryGraphService,
    EngineTasksService,
    PersonaService,
    StructureExecutorService,
    CommunityService,
    TreeBuilderService,
    EnginePlacementService,
    EngineBootstrapService,
  ],
})
export class OrganizationModule {}
