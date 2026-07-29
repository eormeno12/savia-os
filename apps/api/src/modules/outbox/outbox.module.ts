import { Module } from '@nestjs/common';
import { OutboxRelay } from './outbox-relay';
import { VectorGarbageCollector } from './vector-gc';

/**
 * The reconciliation workers. Loaded in the WORKER process only (their @Interval
 * timers run there), so the API just writes outbox rows and the worker drains
 * them. Both are exported so e2e tests can drive them deterministically.
 */
@Module({
  providers: [OutboxRelay, VectorGarbageCollector],
  exports: [OutboxRelay, VectorGarbageCollector],
})
export class OutboxModule {}
