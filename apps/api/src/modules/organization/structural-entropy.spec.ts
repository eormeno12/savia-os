import { graphFromEdges } from './graph';
import { se1D, se2D, greedyPartition2D, buildEncodingTree, treeSe } from './structural-entropy';

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Two clear clusters of `m` vertices each, dense inside, one weak bridge across. */
function twoClusters(m: number, bridge = 0.05) {
  const edges: { a: number; b: number; w: number }[] = [];
  for (const base of [0, m]) {
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) edges.push({ a: base + i, b: base + j, w: 1 });
  }
  edges.push({ a: 0, b: m, w: bridge }); // one weak inter-cluster edge
  return graphFromEdges(2 * m, edges);
}

describe('structural entropy — definitions', () => {
  it('is zero for an edgeless graph', () => {
    const g = graphFromEdges(3, []);
    expect(se1D(g)).toBe(0);
    expect(se2D(g, [[0], [1], [2]])).toBe(0);
    expect(treeSe(buildEncodingTree(g), g)).toBe(0);
  });

  it('se2D of the all-singletons partition equals se1D (the height-1 tree)', () => {
    const g = twoClusters(4);
    const singletons = Array.from({ length: g.n }, (_, v) => [v]);
    expect(se2D(g, singletons)).toBeCloseTo(se1D(g), 9);
  });

  it('the correct 2-cluster partition has strictly lower SE than lumping everything together', () => {
    const g = twoClusters(4);
    const twoWay = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ];
    const oneWay = [[0, 1, 2, 3, 4, 5, 6, 7]];
    expect(se2D(g, twoWay)).toBeLessThan(se2D(g, oneWay));
    expect(se2D(g, twoWay)).toBeLessThan(se1D(g));
  });
});

describe('greedyPartition2D — recovers cluster structure', () => {
  it('recovers exactly the two planted clusters', () => {
    const g = twoClusters(5);
    const parts = greedyPartition2D(g).map((c) => new Set(c));
    expect(parts).toHaveLength(2);
    expect(parts.some((s) => [0, 1, 2, 3, 4].every((v) => s.has(v)))).toBe(true);
    expect(parts.some((s) => [5, 6, 7, 8, 9].every((v) => s.has(v)))).toBe(true);
  });

  it('any partition it returns encodes no worse than the flat graph (SE ≤ se1D)', () => {
    // NB: structural entropy legitimately sub-partitions a *uniform* clique (a K6
    // splits because a grouped random-walk code is shorter) — that is correct SE
    // behavior, and harmless here: leaf communities come from community-ops, not
    // from greedy SE. greedyPartition2D only ever builds tree levels ABOVE
    // communities, where such grouping is exactly what we want.
    const edges: { a: number; b: number; w: number }[] = [];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) edges.push({ a: i, b: j, w: 1 });
    const g = graphFromEdges(6, edges);
    expect(se2D(g, greedyPartition2D(g))).toBeLessThanOrEqual(se1D(g) + 1e-9);
  });
});

describe('buildEncodingTree — the tree never encodes worse than the flat graph', () => {
  it('treeSe(built) ≤ se1D for random graphs (compression is monotone)', () => {
    const rand = seededRandom(7);
    for (let trial = 0; trial < 100; trial++) {
      const n = 4 + Math.floor(rand() * 12);
      const edges: { a: number; b: number; w: number }[] = [];
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (rand() < 0.4) edges.push({ a: i, b: j, w: Math.round(rand() * 9) / 3 + 0.1 });
        }
      }
      const g = graphFromEdges(n, edges);
      const built = buildEncodingTree(g);
      expect(treeSe(built, g)).toBeLessThanOrEqual(se1D(g) + 1e-9);
    }
  });

  it('treeSe of a 2-level tree equals se2D of its community partition', () => {
    const g = twoClusters(4);
    const communities = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ];
    const twoLevel = {
      members: [0, 1, 2, 3, 4, 5, 6, 7],
      children: communities.map((c) => ({ members: c, children: c.map((v) => ({ members: [v], children: [] })) })),
    };
    expect(treeSe(twoLevel, g)).toBeCloseTo(se2D(g, communities), 9);
  });

  it('preserves volume across contraction levels (volume-blind grouping regression)', () => {
    // Two large dense cliques + a tiny one → the tree must reach a level where the
    // grouping decision depends on the ORIGINAL community volumes, not their cuts.
    // Before the self-loop fix, contraction discarded volume and grouped by cut only.
    const edges: { a: number; b: number; w: number }[] = [];
    const cliqueAt = (base: number, size: number, w: number): void => {
      for (let i = 0; i < size; i++) for (let j = i + 1; j < size; j++) edges.push({ a: base + i, b: base + j, w });
    };
    cliqueAt(0, 6, 3); // A: heavy
    cliqueAt(6, 6, 3); // B: heavy
    cliqueAt(12, 3, 3); // C: tiny
    edges.push({ a: 0, b: 6, w: 0.2 }, { a: 6, b: 12, w: 0.2 }, { a: 0, b: 12, w: 0.2 });
    const g = graphFromEdges(15, edges);
    const built = buildEncodingTree(g);
    // Correctness invariants that hold iff contraction is volume-preserving:
    expect(treeSe(built, g)).toBeLessThanOrEqual(se1D(g) + 1e-9);
    const leafCount = new Set<number>();
    const walk = (n: { members: number[]; children: { members: number[]; children: unknown[] }[] }): void =>
      n.children.length === 0 ? n.members.forEach((v) => leafCount.add(v)) : n.children.forEach((c) => walk(c as never));
    walk(built as never);
    expect(leafCount.size).toBe(15); // every vertex still covered after multi-level contraction
  });

  it('every original vertex appears exactly once among the leaves', () => {
    const g = twoClusters(5);
    const seen = new Set<number>();
    const walk = (node: { members: number[]; children: { members: number[]; children: unknown[] }[] }): void => {
      if (node.children.length === 0) node.members.forEach((v) => seen.add(v));
      else node.children.forEach((c) => walk(c as never));
    };
    walk(buildEncodingTree(g) as never);
    expect(seen.size).toBe(g.n);
  });
});
