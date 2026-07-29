import { CrossBoundaryReadService, dedupeCrossPerson, CrossBoundaryHit } from './cross-boundary-read.service';
import type { MemoryService } from './memory.service';
import { P } from '../../common/ports/predicate';
import type { ReadPartition } from '../access/read-plan';

const hit = (ownerUserId: string, text = 'mismo hecho compartido', score = 0.9): CrossBoundaryHit => ({
  memoryId: `${ownerUserId}-m`,
  text,
  score,
  areaIds: [],
  sensitivity: 'normal',
  ownerUserId,
  alsoFrom: [],
});

// Regression: when the viewer is themselves a fragment owner, dedup could push the
// viewer's own id into `alsoFrom`, secretly inflating "también aportado por N más".
describe('dedupeCrossPerson — the viewer is never one of the "also from"', () => {
  it('excludes the viewer from alsoFrom when they also own a duplicate', () => {
    const [merged] = dedupeCrossPerson([hit('W'), hit('viewer')], 'viewer');
    expect(merged.ownerUserId).toBe('W');
    expect(merged.alsoFrom).toHaveLength(0);
    expect(merged.alsoFrom).not.toContain('viewer');
  });

  it('still attributes genuine other members', () => {
    const [merged] = dedupeCrossPerson([hit('W'), hit('X')], 'viewer');
    expect(merged.alsoFrom).toEqual(['X']);
  });

  it('keeps the max score across duplicates', () => {
    const [merged] = dedupeCrossPerson([hit('W', 'shared', 0.5), hit('X', 'shared', 0.95)], 'viewer');
    expect(merged.score).toBe(0.95);
  });
});

describe('CrossBoundaryReadService.searchPartitions — fan-out + dedup', () => {
  it('searches every owner partition, merges and dedups cross-person', async () => {
    const memory = {
      search: jest.fn((owner: string) =>
        Promise.resolve([
          { id: `${owner}-1`, text: 'shared', score: owner === 'bob' ? 0.9 : 0.8, areaIds: [owner], sensitivity: 'normal' },
        ]),
      ),
    } as unknown as MemoryService;
    const svc = new CrossBoundaryReadService(memory);
    const plan: ReadPartition[] = [
      { ownerUserId: 'alice', predicate: P.and() },
      { ownerUserId: 'bob', predicate: P.and() },
    ];

    const hits = await svc.searchPartitions(plan, 'q', 10, 'viewer');

    expect(memory.search).toHaveBeenCalledTimes(2);
    expect(hits).toHaveLength(1); // both said 'shared' → deduped
    expect(hits[0].score).toBe(0.9); // max across owners
    expect([hits[0].ownerUserId, ...hits[0].alsoFrom].sort()).toEqual(['alice', 'bob']);
  });

  it('an empty plan returns [] without hitting the store', async () => {
    const memory = { search: jest.fn() } as unknown as MemoryService;
    const svc = new CrossBoundaryReadService(memory);
    expect(await svc.searchPartitions([], 'q', 10, 'viewer')).toEqual([]);
    expect(memory.search).not.toHaveBeenCalled();
  });
});
