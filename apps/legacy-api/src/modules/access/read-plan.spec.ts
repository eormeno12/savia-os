import { compileReadPlan, ReadPartition } from './read-plan';
import { evaluate, MemoryFacets } from '../../common/ports/predicate';
import { CompiledFragment, CompiledGrant } from './scope-predicate.provider';

const READER = 'reader';

const space = (areaId: string, includeSensitive = false): CompiledGrant => ({ scope: 'space', areaId, includeSensitive });
const frag = (areaId: string, ownerUserId: string, includeSensitive = false): CompiledFragment => ({
  areaId,
  ownerUserId,
  includeSensitive,
});
const group = (fragments: CompiledFragment[]): CompiledGrant => ({ scope: 'group', fragments, includeSensitive: false });

const mem = (areaIds: string[], extra: Partial<MemoryFacets> = {}): MemoryFacets => ({
  areaIds,
  userId: 'author',
  sensitivity: 'normal',
  superseded: false,
  ...extra,
});

const partitionFor = (plan: ReadPartition[], owner: string) => plan.find((p) => p.ownerUserId === owner);
const sees = (plan: ReadPartition[], owner: string, facets: MemoryFacets) => {
  const part = partitionFor(plan, owner);
  return part ? evaluate(part.predicate, facets) : false;
};

describe('compileReadPlan — cross-boundary read frontier (spec-15 + R4)', () => {
  describe('(1) default-deny', () => {
    it('no grants → no partitions', () => {
      expect(compileReadPlan([], READER)).toEqual([]);
    });
    it('an empty group (no fragments) → no partitions', () => {
      expect(compileReadPlan([group([])], READER)).toEqual([]);
    });
  });

  describe('space grants — the reader owns the area', () => {
    it('a space grant makes one partition owned by the reader', () => {
      const plan = compileReadPlan([space('trabajo')], READER);
      expect(plan).toHaveLength(1);
      expect(plan[0].ownerUserId).toBe(READER);
      expect(sees(plan, READER, mem(['trabajo']))).toBe(true);
      expect(sees(plan, READER, mem(['salud']))).toBe(false);
    });
    it("space sensitivity follows the reader's own grant opt-in", () => {
      const sensitive = mem(['trabajo'], { sensitivity: 'sensitive' });
      expect(sees(compileReadPlan([space('trabajo', false)], READER), READER, sensitive)).toBe(false);
      expect(sees(compileReadPlan([space('trabajo', true)], READER), READER, sensitive)).toBe(true);
    });
  });

  describe('group grants — fan out per fragment owner', () => {
    it('makes one partition per owner, each pinned to that owner', () => {
      const plan = compileReadPlan([group([frag('a', 'alice'), frag('b', 'bob')])], READER);
      expect(plan.map((p) => p.ownerUserId).sort()).toEqual(['alice', 'bob']);
      // Each partition only sees ITS owner's memory in the shared area.
      expect(sees(plan, 'alice', mem(['a'], { userId: 'alice' }))).toBe(true);
      expect(sees(plan, 'alice', mem(['a'], { userId: 'bob' }))).toBe(false); // author pin
      expect(sees(plan, 'bob', mem(['b'], { userId: 'bob' }))).toBe(true);
    });

    it('R4: group sensitivity is the fragment OWNER opt-in, never the reader', () => {
      const sensitive = mem(['a'], { userId: 'alice', sensitivity: 'sensitive' });
      // owner did NOT opt in → sensitive excluded
      expect(sees(compileReadPlan([group([frag('a', 'alice', false)])], READER), 'alice', sensitive)).toBe(false);
      // owner opted in → sensitive flows
      expect(sees(compileReadPlan([group([frag('a', 'alice', true)])], READER), 'alice', sensitive)).toBe(true);
      // a normal memory from a non-opted fragment still flows
      expect(sees(compileReadPlan([group([frag('a', 'alice', false)])], READER), 'alice', mem(['a'], { userId: 'alice' }))).toBe(true);
    });
  });

  describe('merge by owner', () => {
    it("a space grant and the reader's own shared fragment collapse into one partition", () => {
      const plan = compileReadPlan([space('own'), group([frag('shared', READER)])], READER);
      expect(plan).toHaveLength(1);
      expect(plan[0].ownerUserId).toBe(READER);
      expect(sees(plan, READER, mem(['own']))).toBe(true);
      expect(sees(plan, READER, mem(['shared'], { userId: READER }))).toBe(true);
    });
  });

  describe('(2) clamp — requested only narrows', () => {
    it('a requested area intersects each partition, never widens', () => {
      const plan = compileReadPlan([space('trabajo')], READER, ['proyecto-x']);
      expect(sees(plan, READER, mem(['trabajo', 'proyecto-x']))).toBe(true); // in both
      expect(sees(plan, READER, mem(['trabajo']))).toBe(false); // not in requested
    });
  });

  describe('superseded is always excluded', () => {
    it('a superseded memory is invisible even within a granted area', () => {
      const plan = compileReadPlan([space('trabajo')], READER);
      expect(sees(plan, READER, mem(['trabajo'], { superseded: true }))).toBe(false);
    });
  });
});
