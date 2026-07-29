import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { P } from '../../common/ports/predicate';
import { EngineTasksService } from './engine-tasks.service';
import { MemoryGraphService } from './memory-graph.service';
import { PersonaService } from './persona.service';
import { CommunityService } from './community.service';
import { TreeBuilderService } from './tree-builder.service';

/**
 * Drains the engine's work queue (event-driven — the tick only ever finds work
 * after a mutation enqueued it; an idle user has an empty queue). Per user it
 * coalesces the pending batch: apply removals, then upserts, into the mutual-kNN
 * graph → recompute the touched personas → reconcile communities → run any
 * coalesced encoding-tree rebuild. One import of N chunks collapses to one pass.
 * Runs in the worker process only (registered in worker.ts).
 */
@Injectable()
export class EngineWorker {
  private readonly logger = new Logger(EngineWorker.name);
  private running = false;

  constructor(
    private readonly tasks: EngineTasksService,
    private readonly vectors: VectorStorePort,
    private readonly graph: MemoryGraphService,
    private readonly personas: PersonaService,
    private readonly communities: CommunityService,
    private readonly treeBuilder: TreeBuilderService,
  ) {}

  @Interval('engine-drain', 1000)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const userId of await this.tasks.pendingUserIds()) {
        await this.drainUser(userId).catch((e) => this.logger.error(`engine drain ${userId}: ${(e as Error).message}`));
      }
    } finally {
      this.running = false;
    }
  }

  /** Public for tests. Process one user's pending batch as a coalesced unit. */
  async drainUser(userId: string): Promise<void> {
    const claimed = await this.tasks.claimForUser(userId);
    if (claimed.length === 0) return;

    const upserted = new Set<string>();
    const removed = new Set<string>();
    const rebuilds = new Set<string>();
    for (const t of claimed) {
      const payload = t.payload as { memoryId?: string; componentId?: string };
      if (t.kind === 'memory_upserted' && payload.memoryId) upserted.add(payload.memoryId);
      else if (t.kind === 'memory_removed' && payload.memoryId) removed.add(payload.memoryId);
      else if (t.kind === 'rebuild_component' && payload.componentId) rebuilds.add(payload.componentId);
    }

    try {
      const affected = new Set<string>();
      for (const memoryId of removed) {
        for (const n of await this.graph.remove(memoryId)) affected.add(n);
        affected.add(memoryId); // its own personas must be recomputed (→ deleted)
      }
      for (const memoryId of upserted) {
        if (removed.has(memoryId)) continue; // net-removed this batch
        const [point] = await this.vectors.retrieve([memoryId], P.author(userId), { withVectors: true });
        if (!point?.vector?.length) continue;
        for (const n of await this.graph.insert(memoryId, userId, point.vector)) affected.add(n);
      }

      const touchedPersonas = await this.personas.recompute(userId, affected);
      await this.communities.reconcile(userId, touchedPersonas);
      for (const componentId of rebuilds) await this.treeBuilder.rebuild(userId, componentId);

      for (const t of claimed) await this.tasks.complete(t.id);
    } catch (err) {
      for (const t of claimed) await this.tasks.fail(t, err);
      throw err;
    }
  }
}
