import { P, evaluate, MemoryFacets } from './predicate';

const facets = (extra: Partial<MemoryFacets> = {}): MemoryFacets => ({
  userId: 'me',
  areaIds: ['a'],
  sensitivity: 'normal',
  superseded: false,
  ...extra,
});

describe('P.own — the owner-scoped read scope', () => {
  it('matches my own non-superseded memories, never another user', () => {
    const p = P.own('me');
    expect(evaluate(p, facets())).toBe(true);
    expect(evaluate(p, facets({ userId: 'other' }))).toBe(false);
    expect(evaluate(p, facets({ superseded: true }))).toBe(false);
  });

  it('sees my sensitive memories — the owner sees everything of their own', () => {
    expect(evaluate(P.own('me'), facets({ sensitivity: 'sensitive' }))).toBe(true);
  });

  it('empty/omitted areaIds means ALL my areas (owner-scoped ≠ grant default-deny)', () => {
    expect(evaluate(P.own('me', { areaIds: [] }), facets({ areaIds: ['z'] }))).toBe(true);
    expect(evaluate(P.own('me'), facets({ areaIds: ['z'] }))).toBe(true);
  });

  it('non-empty areaIds constrains to those areas (intersection)', () => {
    const p = P.own('me', { areaIds: ['a'] });
    expect(evaluate(p, facets({ areaIds: ['a', 'b'] }))).toBe(true);
    expect(evaluate(p, facets({ areaIds: ['z'] }))).toBe(false);
  });

  it('includeSuperseded keeps superseded points (export / purge / membership rewrite)', () => {
    expect(evaluate(P.own('me', { includeSuperseded: true }), facets({ superseded: true }))).toBe(true);
    // still owner-scoped: another user's superseded point is never matched
    expect(evaluate(P.own('me', { includeSuperseded: true }), facets({ userId: 'other', superseded: true }))).toBe(false);
  });
});
