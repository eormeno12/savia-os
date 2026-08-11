import { evaluate, MemoryFacets } from '../../common/ports/predicate';
import { compileAccessFilter } from './access-filter.compiler';
import { CompiledFragment, CompiledGrant } from './scope-predicate.provider';

const grantSpace = (areaId: string, includeSensitive = false): CompiledGrant => ({
  scope: 'space',
  areaId,
  includeSensitive,
});

const grantGroup = (fragments: CompiledFragment[], includeSensitive = false): CompiledGrant => ({
  scope: 'group',
  fragments,
  includeSensitive,
});

/** A memory whose membership carries its ancestors (write-time closure). */
const mem = (areaIds: string[], extra: Partial<MemoryFacets> = {}): MemoryFacets => ({
  areaIds,
  userId: 'author',
  sensitivity: 'normal',
  superseded: false,
  ...extra,
});

/** A group fragment: its area, its owner, and the OWNER's sensitivity opt-in (R4). */
const frag = (areaId: string, ownerUserId: string, includeSensitive = false): CompiledFragment => ({
  areaId,
  ownerUserId,
  includeSensitive,
});

const visible = (grants: CompiledGrant[], facets: MemoryFacets, requested?: string[]) =>
  evaluate(compileAccessFilter(grants, requested), facets);

describe('compileAccessFilter — the four spec-15 invariants', () => {
  describe('(1) default-deny', () => {
    it('no grants → nothing is visible', () => {
      expect(visible([], mem(['trabajo']))).toBe(false);
    });
    it('a memory in an un-granted area is invisible', () => {
      expect(visible([grantSpace('trabajo')], mem(['salud']))).toBe(false);
    });
  });

  describe('(2) clamp — requested can only narrow', () => {
    it('requesting a granted area keeps it', () => {
      expect(visible([grantSpace('trabajo')], mem(['trabajo']), ['trabajo'])).toBe(true);
    });
    it('requesting an un-granted area cannot widen access', () => {
      // memory lives in 'salud' (not granted); requesting 'salud' must not expose it.
      expect(visible([grantSpace('trabajo')], mem(['salud']), ['salud'])).toBe(false);
    });
    it('clamp intersects: granted ∩ requested', () => {
      const m = mem(['trabajo', 'proyecto-x']);
      expect(visible([grantSpace('trabajo')], m, ['proyecto-x'])).toBe(true); // in both
      expect(visible([grantSpace('trabajo')], mem(['trabajo']), ['proyecto-x'])).toBe(false); // not in requested
    });
  });

  describe('(3) sensitivity', () => {
    const sensitive = mem(['trabajo'], { sensitivity: 'sensitive' });
    it('sensitive never flows without includeSensitive', () => {
      expect(visible([grantSpace('trabajo', false)], sensitive)).toBe(false);
    });
    it('sensitive flows when the grant opts in', () => {
      expect(visible([grantSpace('trabajo', true)], sensitive)).toBe(true);
    });
    it('normal memories are unaffected', () => {
      expect(visible([grantSpace('trabajo', false)], mem(['trabajo']))).toBe(true);
    });
  });

  describe('(4) subtree via ancestors, not siblings', () => {
    // Tree: General > Trabajo > ProyectoX ; General > BasesDeDatos
    const childMem = mem(['proyecto-x', 'trabajo', 'general']); // carries ancestors
    const siblingMem = mem(['bases-de-datos', 'general']);
    it('a grant on a parent sees its descendants', () => {
      expect(visible([grantSpace('trabajo')], childMem)).toBe(true);
    });
    it('a grant on a parent does NOT see siblings of the parent', () => {
      expect(visible([grantSpace('trabajo')], siblingMem)).toBe(false);
    });
    it('a grant on a child does NOT see the parent-only memories', () => {
      const parentOnly = mem(['trabajo', 'general']);
      expect(visible([grantSpace('proyecto-x')], parentOnly)).toBe(false);
    });
  });

  describe('superseded memories are excluded from reads', () => {
    it('a superseded memory is invisible even within a granted area', () => {
      expect(visible([grantSpace('trabajo')], mem(['trabajo'], { superseded: true }))).toBe(false);
    });
  });

  // Every test above uses `grantSpace` (scope 'space'). Group grants ('group')
  // go through `fragmentsPredicate`/`fragmentScope` instead — a materially
  // different code path (an OR of per-member fragments, each self-asserting
  // its own author) that had zero coverage anywhere in the codebase.
  describe('group scope — fragments carry their own author (multi-owner union)', () => {
    it("a fragment exposes its owner's memory in the shared area", () => {
      expect(visible([grantGroup([frag('compartida', 'alice')])], mem(['compartida'], { userId: 'alice' }))).toBe(true);
    });

    it('a fragment does NOT expose a different user\'s memory under the same area id — the whole point of the author check', () => {
      expect(visible([grantGroup([frag('compartida', 'alice')])], mem(['compartida'], { userId: 'bob' }))).toBe(false);
    });

    it("two members' fragments OR together, each still scoped to its own owner", () => {
      const grant = grantGroup([frag('area-alice', 'alice'), frag('area-bob', 'bob')]);
      expect(visible([grant], mem(['area-alice'], { userId: 'alice' }))).toBe(true);
      expect(visible([grant], mem(['area-bob'], { userId: 'bob' }))).toBe(true);
      // Bob's memory must not leak through Alice's fragment slot.
      expect(visible([grant], mem(['area-alice'], { userId: 'bob' }))).toBe(false);
    });

    // R4: for a GROUP fragment, sensitivity is the fragment OWNER's opt-in
    // (FragmentShare.includeSensitive), NOT the reader's grant. This is the assertion
    // that used to encode the leak (a reader grant with includeSensitive=true surfaced
    // another owner's sensitive) — now the reader can never lift it.
    it('group sensitivity is the fragment OWNER opt-in, never the reader grant (R4)', () => {
      const sensitive = mem(['compartida'], { userId: 'alice', sensitivity: 'sensitive' });
      const gated = frag('compartida', 'alice', false); // owner did NOT opt in
      const opted = frag('compartida', 'alice', true); // owner opted in
      // Reader's grant includeSensitive cannot lift a non-opted fragment:
      expect(visible([grantGroup([gated], true)], sensitive)).toBe(false);
      expect(visible([grantGroup([gated], false)], sensitive)).toBe(false);
      // Owner opted the fragment in → sensitive flows (reader grant irrelevant):
      expect(visible([grantGroup([opted], false)], sensitive)).toBe(true);
      expect(visible([grantGroup([opted], true)], sensitive)).toBe(true);
      // A non-sensitive memory from a non-opted fragment still flows.
      expect(visible([grantGroup([gated])], mem(['compartida'], { userId: 'alice' }))).toBe(true);
    });

    it('clamp still narrows group-scope grants', () => {
      const aliceMem = mem(['compartida'], { userId: 'alice' });
      expect(visible([grantGroup([frag('compartida', 'alice')])], aliceMem, ['otra-area'])).toBe(false);
    });

    it('an empty fragments list contributes nothing (default-deny for that grant)', () => {
      expect(visible([grantGroup([])], mem(['cualquiera']))).toBe(false);
    });
  });
});
