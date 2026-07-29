import { Module } from '@nestjs/common';
import { WriteKernelPolicy } from './write-kernel.policy';
import { MemoryMutationService } from './memory-mutation.service';

/**
 * The write-kernel (08 §6.3). Sits over the global InfraModule. Exports the
 * mutation service — the single legal way to write memory state — so memory,
 * routing and the dynamic engine all funnel through it.
 */
@Module({
  providers: [{ provide: WriteKernelPolicy, useClass: WriteKernelPolicy }, MemoryMutationService],
  exports: [MemoryMutationService],
})
export class KernelModule {}
