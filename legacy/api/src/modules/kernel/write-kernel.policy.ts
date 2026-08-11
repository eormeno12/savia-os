/**
 * The write-kernel POLICY (08 §6.3 / 0A F1) — a pure reference monitor. It admits
 * a memory mutation only if it cannot cause irreversible or boundary-crossing
 * harm. Because it's pure (no DB), the invariants are unit-tested directly:
 *
 *   ✓ scope-confined  — every target area belongs to the memory's author
 *                       (the engine can never move memory across owners)
 *   ✓ no hard delete  — the op vocabulary has no "delete vector"; removal is
 *                       supersede (soft, reversible). Hard purge is a separate,
 *                       audited path (VectorGarbageCollector), never the kernel.
 *   ✓ reversible      — every op carries enough to record its inverse
 *   ✓ sensitive-gated — sensitivity is a property, enforced at read, never here
 */
export type KernelOp =
  | {
      kind: 'assign';
      memoryId: string;
      authorUserId: string;
      membership: string[];
      areaOwners: Record<string, string>; // areaId → ownerUserId (fetched by caller)
    }
  | {
      kind: 'move';
      memoryId: string;
      authorUserId: string;
      membership: string[];
      areaOwners: Record<string, string>;
    }
  | { kind: 'supersede'; memoryId: string; authorUserId: string; supersededBy: string }
  | { kind: 'sensitivity'; memoryId: string; authorUserId: string; sensitivity: 'normal' | 'sensitive' }
  | { kind: 'seed'; spaceId: string; authorUserId: string; spaceOwnerUserId: string; memoryIds: string[] };

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

const ALLOW: PolicyDecision = { allowed: true };
const deny = (reason: string): PolicyDecision => ({ allowed: false, reason });

export class WriteKernelPolicy {
  decide(op: KernelOp): PolicyDecision {
    switch (op.kind) {
      case 'assign':
      case 'move': {
        if (op.membership.length === 0) return deny('empty membership');
        // scope-confinement: every target area is owned by the memory's author.
        for (const areaId of op.membership) {
          const owner = op.areaOwners[areaId];
          if (owner === undefined) return deny(`unknown area ${areaId}`);
          if (owner !== op.authorUserId) return deny(`area ${areaId} crosses ownership scope`);
        }
        return ALLOW;
      }
      case 'supersede':
        return op.supersededBy === op.memoryId ? deny('cannot supersede by itself') : ALLOW;
      case 'sensitivity':
        return ALLOW;
      case 'seed':
        return op.spaceOwnerUserId === op.authorUserId ? ALLOW : deny('area crosses ownership scope');
    }
  }
}
