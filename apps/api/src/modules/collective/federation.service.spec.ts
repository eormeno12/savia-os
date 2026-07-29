import { FederationService } from './federation.service';
import type { AccessService } from '../access/access.service';
import type { CrossBoundaryReadService, CrossBoundaryHit } from '../memory/cross-boundary-read.service';
import { P } from '../../common/ports/predicate';
import type { ReadPartition } from '../access/read-plan';

// FederationService is now a thin mapper: it delegates the WHOLE read policy to
// AccessService.buildGroupReadPlan (membership + per-owner plan + R4 sensitivity)
// and CrossBoundaryReadService.searchPartitions (fan-out + dedup). The policy
// itself is proven in read-plan.spec / access.service.spec / cross-boundary-read.service.spec.
describe('FederationService.search — maps cross-boundary hits to GroupMemoryDto', () => {
  it('delegates to the access plan + executor and maps owner→author', async () => {
    const plan: ReadPartition[] = [{ ownerUserId: 'alice', predicate: P.and() }];
    const access = { buildGroupReadPlan: jest.fn().mockResolvedValue(plan) } as unknown as AccessService;
    const hits: CrossBoundaryHit[] = [
      { memoryId: 'm1', text: 'hecho', score: 0.9, areaIds: ['a'], sensitivity: 'normal', ownerUserId: 'alice', alsoFrom: ['bob'] },
    ];
    const reader = { searchPartitions: jest.fn().mockResolvedValue(hits) } as unknown as CrossBoundaryReadService;

    const out = await new FederationService(access, reader).search('g', 'viewer', 'q', { limit: 5 });

    expect(access.buildGroupReadPlan).toHaveBeenCalledWith('g', 'viewer');
    expect(reader.searchPartitions).toHaveBeenCalledWith(plan, 'q', 5, 'viewer');
    expect(out).toEqual([
      { memoryId: 'm1', text: 'hecho', score: 0.9, authorUserId: 'alice', alsoFrom: ['bob'], sensitivity: 'normal' },
    ]);
  });
});
