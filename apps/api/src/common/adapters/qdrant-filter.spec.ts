import { P } from '../ports/predicate';
import { compilePredicate } from './qdrant-filter';

describe('compilePredicate', () => {
  it('areaIdsAny → savia_area_ids ANY', () => {
    expect(compilePredicate(P.areaIdsAny(['a', 'b']))).toEqual({
      must: [{ key: 'savia_area_ids', match: { any: ['a', 'b'] } }],
    });
  });

  it('sensitivityNormal excludes sensitive via must_not', () => {
    expect(compilePredicate(P.sensitivityNormal())).toEqual({
      must_not: [{ key: 'savia_sensitivity', match: { value: 'sensitive' } }],
    });
  });

  it('and nests sub-filters under must', () => {
    const out = compilePredicate(P.and(P.areaIdsAny(['a']), P.notSuperseded()));
    expect(out).toEqual({
      must: [
        { must: [{ key: 'savia_area_ids', match: { any: ['a'] } }] },
        { must_not: [{ key: 'savia_superseded', match: { value: true } }] },
      ],
    });
  });

  it('or nests sub-filters under should', () => {
    const out = compilePredicate(P.or(P.areaIdsAny(['a']), P.areaIdsAny(['b'])));
    expect(out.should).toHaveLength(2);
  });

  it('denyAll compiles to a never-matching condition', () => {
    expect(compilePredicate(P.denyAll())).toEqual({
      must: [{ key: '__savia_deny__', match: { value: true } }],
    });
  });

  it('P.areaIdsAny([]) collapses to denyAll (default-deny)', () => {
    expect(P.areaIdsAny([])).toEqual({ t: 'denyAll' });
  });
});
