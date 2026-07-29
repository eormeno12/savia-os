import { assignPersona, decideCommunityOps, PersonaEdge } from './community-ops';

const NONE = new Set<string>();

/** Clique of `ids` with intra weight `w`. */
function clique(ids: string[], w: number): PersonaEdge[] {
  const out: PersonaEdge[] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push({ a: ids[i], b: ids[j], w });
  return out;
}

function communityMap(groups: Record<string, string[]>): Map<string, string> {
  const m = new Map<string, string>();
  for (const [c, members] of Object.entries(groups)) for (const p of members) m.set(p, c);
  return m;
}

describe('assignPersona — online placement by plurality of edge weight', () => {
  it('joins the community holding the most of its edge weight', () => {
    const edges: PersonaEdge[] = [
      { a: 'x', b: 'a1', w: 0.9 },
      { a: 'x', b: 'b1', w: 0.3 },
    ];
    const communityOf = communityMap({ A: ['a1'], B: ['b1'] });
    expect(assignPersona('x', edges, communityOf)).toBe('A');
  });

  it('returns null for an isolated persona (→ new community / General)', () => {
    expect(assignPersona('lonely', [], new Map())).toBeNull();
  });
});

describe('decideCommunityOps — the hysteresis band', () => {
  it('merges two communities coupled at or above MERGE_HI', () => {
    // A={a1,a2}, B={b1,b2}; strong cross edges (a1-b1, a2-b2 at w=1), weak intra.
    const edges: PersonaEdge[] = [
      ...clique(['a1', 'a2'], 0.3),
      ...clique(['b1', 'b2'], 0.3),
      { a: 'a1', b: 'b1', w: 1 },
      { a: 'a2', b: 'b2', w: 1 },
    ];
    const ops = decideCommunityOps(edges, communityMap({ A: ['a1', 'a2'], B: ['b1', 'b2'] }), NONE);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('merge');
  });

  it('does NOT merge communities coupled inside the band', () => {
    // one weak bridge → coupling well below MERGE_HI
    const edges: PersonaEdge[] = [
      ...clique(['a1', 'a2', 'a3'], 1),
      ...clique(['b1', 'b2', 'b3'], 1),
      { a: 'a1', b: 'b1', w: 0.4 },
    ];
    const ops = decideCommunityOps(edges, communityMap({ A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'] }), NONE);
    expect(ops).toEqual([]);
  });

  it('splits a community whose sparsest internal bipartition is at or below SPLIT_LO', () => {
    // one community = two triangles joined by a single weak bridge
    const edges: PersonaEdge[] = [
      ...clique(['x1', 'x2', 'x3'], 1),
      ...clique(['y1', 'y2', 'y3'], 1),
      { a: 'x1', b: 'y1', w: 0.1 },
    ];
    const ops = decideCommunityOps(edges, communityMap({ C: ['x1', 'x2', 'x3', 'y1', 'y2', 'y3'] }), NONE);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('split');
    if (ops[0].kind === 'split') {
      const sides = [new Set(ops[0].groupA), new Set(ops[0].groupB)];
      expect(sides.some((s) => ['x1', 'x2', 'x3'].every((v) => s.has(v)))).toBe(true);
      expect(sides.some((s) => ['y1', 'y2', 'y3'].every((v) => s.has(v)))).toBe(true);
    }
  });

  it('does NOT split a dense (internally cohesive) community', () => {
    const edges = clique(['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], 1);
    expect(decideCommunityOps(edges, communityMap({ A: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'] }), NONE)).toEqual([]);
  });

  it('never touches a frozen (governance=manual) community', () => {
    const edges: PersonaEdge[] = [
      ...clique(['a1', 'a2'], 0.3),
      ...clique(['b1', 'b2'], 0.3),
      { a: 'a1', b: 'b1', w: 1 },
      { a: 'a2', b: 'b2', w: 1 },
    ];
    const frozen = new Set(['A']);
    expect(decideCommunityOps(edges, communityMap({ A: ['a1', 'a2'], B: ['b1', 'b2'] }), frozen)).toEqual([]);
  });
});

describe('NO OSCILLATION — the structural invariant', () => {
  it('a freshly-MERGED community does not split back (dense interior ≥ MERGE_HI)', () => {
    // the two halves were merge-eligible (strong cross); after merging into M their
    // former cross edges are intra and strong → sparsest bipartition stays high.
    const edges: PersonaEdge[] = [
      ...clique(['a1', 'a2', 'a3'], 1),
      ...clique(['b1', 'b2', 'b3'], 1),
      { a: 'a1', b: 'b1', w: 1 },
      { a: 'a2', b: 'b2', w: 1 },
      { a: 'a3', b: 'b3', w: 1 },
    ];
    const merged = communityMap({ M: ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'] });
    expect(decideCommunityOps(edges, merged, NONE)).toEqual([]);
  });

  it('a freshly-SPLIT pair does not re-merge (coupling ≤ SPLIT_LO < MERGE_HI)', () => {
    const edges: PersonaEdge[] = [
      ...clique(['x1', 'x2', 'x3'], 1),
      ...clique(['y1', 'y2', 'y3'], 1),
      { a: 'x1', b: 'y1', w: 0.1 },
    ];
    const split = communityMap({ X: ['x1', 'x2', 'x3'], Y: ['y1', 'y2', 'y3'] });
    expect(decideCommunityOps(edges, split, NONE)).toEqual([]);
  });

  it('rejects a merge that a strong bridge would make splittable (asymmetric danglers)', () => {
    // A has a weakly-bonded a3 (a2-a3=0.4); a strong bridge a3-b1=3 to a dense clique B.
    // Bridge coupling ≥ MERGE_HI, but merging would strand {a1,a2} (sparse internal cut
    // ≤ SPLIT_LO). The merge MUST be rejected — this is the counterexample that broke the
    // naive "SPLIT_LO < MERGE_HI suffices" guarantee.
    const edges: PersonaEdge[] = [
      { a: 'a1', b: 'a2', w: 1 },
      { a: 'a2', b: 'a3', w: 0.4 },
      ...clique(['b1', 'b2', 'b3'], 10),
      { a: 'a3', b: 'b1', w: 3 },
    ];
    const ops = decideCommunityOps(edges, communityMap({ A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'] }), NONE);
    expect(ops.filter((o) => o.kind === 'merge')).toEqual([]);
  });

  it('finds the sparse cut that peels an END off a path of ≥3 clusters (not only largest-vs-rest)', () => {
    // three triangle-cliques A-B-C in a path with equal bridges; the sparsest cut is
    // {A}|{B,C} (one bridge), which a largest-vs-rest heuristic would miss when all
    // components tie in size.
    const edges: PersonaEdge[] = [
      ...clique(['a1', 'a2', 'a3'], 10),
      ...clique(['b1', 'b2', 'b3'], 10),
      ...clique(['c1', 'c2', 'c3'], 10),
      { a: 'a1', b: 'b1', w: 1 },
      { a: 'b2', b: 'c1', w: 1 },
    ];
    const ops = decideCommunityOps(
      edges,
      communityMap({ M: ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3'] }),
      NONE,
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe('split');
  });

  it('no configuration in the band ever produces both a merge and its inverse split', () => {
    // sweep bridge weights across the whole band and beyond; whenever a merge fires,
    // applying it must not then yield a split of the merged community, and vice-versa.
    for (let k = 0; k <= 20; k++) {
      const bridge = (k / 20) * 1.2; // 0 .. 1.2, sweeping through the band
      const edges: PersonaEdge[] = [
        ...clique(['a1', 'a2', 'a3'], 1),
        ...clique(['b1', 'b2', 'b3'], 1),
        { a: 'a1', b: 'b1', w: bridge },
        { a: 'a2', b: 'b2', w: bridge },
        { a: 'a3', b: 'b3', w: bridge },
      ];
      const ops = decideCommunityOps(edges, communityMap({ A: ['a1', 'a2', 'a3'], B: ['b1', 'b2', 'b3'] }), NONE);
      if (ops.some((o) => o.kind === 'merge')) {
        // apply the merge, then assert the merged community does not split back
        const after = decideCommunityOps(
          edges,
          communityMap({ M: ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'] }),
          NONE,
        );
        expect(after.filter((o) => o.kind === 'split')).toEqual([]);
      }
    }
  });
});
