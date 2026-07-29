import { egoSplit, matchPersonas } from './ego-split';

describe('egoSplit — personas = connected components of the ego-net', () => {
  it('a memory whose neighbors form two disconnected worlds gets exactly two personas', () => {
    // ego "m" has neighbors {p1,p2} (Python world) and {a1,a2} (Ana world),
    // connected within each world but NOT across → two personas.
    const neighbors = ['p1', 'p2', 'a1', 'a2'];
    const among: [string, string][] = [
      ['p1', 'p2'],
      ['a1', 'a2'],
    ];
    const personas = egoSplit(neighbors, among).map((p) => new Set(p));
    expect(personas).toHaveLength(2);
    expect(personas.some((s) => s.has('p1') && s.has('p2') && !s.has('a1'))).toBe(true);
    expect(personas.some((s) => s.has('a1') && s.has('a2') && !s.has('p1'))).toBe(true);
  });

  it('a fully-connected ego-net is a single persona (no false overlap)', () => {
    const neighbors = ['x', 'y', 'z'];
    const among: [string, string][] = [
      ['x', 'y'],
      ['y', 'z'],
      ['x', 'z'],
    ];
    expect(egoSplit(neighbors, among)).toHaveLength(1);
  });

  it('isolated neighbors (empty ego-net) each become their own persona', () => {
    expect(egoSplit(['a', 'b', 'c'], [])).toHaveLength(3);
  });

  it('recovers a literal overlap: the bridge world stays split even if worlds share a member elsewhere', () => {
    // p2 links only to p1; a2 links only to a1; p1..a1 never connect → two personas.
    const personas = egoSplit(['p1', 'p2', 'a1', 'a2'], [
      ['p1', 'p2'],
      ['a1', 'a2'],
    ]);
    expect(personas).toHaveLength(2);
  });

  it('ignores edges that touch non-neighbors', () => {
    const personas = egoSplit(['a', 'b'], [
      ['a', 'b'],
      ['a', 'ghost'],
    ]);
    expect(personas).toHaveLength(1);
  });

  it('empty neighbor set yields no personas', () => {
    expect(egoSplit([], [])).toEqual([]);
  });
});

describe('matchPersonas — stable identity across recomputes', () => {
  it('matches each new persona to the old one with maximal neighbor overlap', () => {
    const oldP = [
      { id: 'old-A', neighbors: ['p1', 'p2', 'p3'] },
      { id: 'old-B', neighbors: ['a1', 'a2'] },
    ];
    const newP = [
      ['a1', 'a2', 'a3'], // best overlaps old-B
      ['p1', 'p2'], // best overlaps old-A
    ];
    expect(matchPersonas(oldP, newP)).toEqual(['old-B', 'old-A']);
  });

  it('assigns null to a genuinely new persona (no overlap)', () => {
    const oldP = [{ id: 'old-A', neighbors: ['p1', 'p2'] }];
    const newP = [['p1', 'p2'], ['z1', 'z2']];
    expect(matchPersonas(oldP, newP)).toEqual(['old-A', null]);
  });

  it('never reuses one old id for two new personas', () => {
    const oldP = [{ id: 'old-A', neighbors: ['p1', 'p2', 'p3'] }];
    const newP = [['p1', 'p2'], ['p3']];
    const m = matchPersonas(oldP, newP);
    expect(m.filter((x) => x === 'old-A')).toHaveLength(1);
    expect(m).toContain(null);
  });
});
