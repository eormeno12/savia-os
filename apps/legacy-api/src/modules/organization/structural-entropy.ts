import { WeightedGraph, degree, volume } from './graph';

/**
 * Structural entropy (Li & Pan 2016) and its minimization (HISEvent, Cao et al.
 * AAAI 2024). The structural entropy of a graph under an encoding tree measures
 * the bits to encode a random walk; the tree that MINIMIZES it is the graph's
 * natural hierarchy. For Savia this makes the area tree the minimum-length code
 * of a user's memory topology — an area exists exactly when naming it compresses
 * the description. Depth emerges where it pays (generalizes the old BIC gate).
 *
 * Pure functions over `WeightedGraph`; every property is a unit assertion.
 */

const LOG2 = Math.log(2);
const log2 = (x: number): number => Math.log(x) / LOG2;
/** x·log2(x) with the entropy convention 0·log0 = 0. */
const xlog2x = (x: number): number => (x <= 0 ? 0 : x * log2(x));

/** 1-D structural entropy: the degree-distribution entropy (height-1 tree). */
export function se1D(g: WeightedGraph): number {
  const vol = volume(g);
  if (vol <= 0) return 0;
  let h = 0;
  for (let v = 0; v < g.n; v++) {
    const d = degree(g, v);
    if (d > 0) h -= (d / vol) * log2(d / vol);
  }
  return h;
}

/**
 * Exact 2-D structural entropy of a given partition (height-2 encoding tree):
 * root → communities → vertices. Used as the correctness oracle in tests and as
 * the monotonicity guard for the online rebuild (only apply a rebuild if SE does
 * not increase).
 */
export function se2D(g: WeightedGraph, partition: readonly number[][]): number {
  const vol = volume(g);
  if (vol <= 0) return 0;
  let h = 0;
  for (const community of partition) {
    const vC = communityVolume(g, community);
    if (vC <= 0) continue;
    // leaf terms: -(d_v/vol) log2(d_v/V_C)
    for (const v of community) {
      const d = degree(g, v);
      if (d > 0) h -= (d / vol) * log2(d / vC);
    }
    // community term: -(g_C/vol) log2(V_C/vol)
    const gC = communityCut(g, community);
    if (gC > 0) h -= (gC / vol) * log2(vC / vol);
  }
  return h;
}

/**
 * Greedy 2-D SE minimization (HISEvent vanilla step): start each vertex as its
 * own community, repeatedly merge the adjacent pair that most decreases 2-D SE,
 * stop when no merge decreases it. Returns the resulting communities as vertex
 * lists. The closed-form ΔSE (from the leaf + community terms) makes each candidate
 * O(1) to score.
 */
export function greedyPartition2D(g: WeightedGraph): number[][] {
  const vol = volume(g);
  const members: (number[] | null)[] = Array.from({ length: g.n }, (_, v) => [v]);
  const volC = Array.from({ length: g.n }, (_, v) => degree(g, v)); // V_C, incl. self-loop mass
  // g_C = EXTERNAL cut = degree − self-loop. For an original singleton (no self-loop)
  // this is the degree; for a contracted super-vertex it excludes the internal mass
  // the volume-preserving self-loop carries — so merge deltas at levels ≥2 score on
  // true volumes, not on cuts.
  const gC = Array.from({ length: g.n }, (_, v) => degree(g, v) - (g.adj[v].get(v) ?? 0));
  // pairwise merge structure excludes self-loops (they are internal, never a merge edge)
  const adjW: Map<number, number>[] = g.adj.map((m, v) => {
    const c = new Map(m);
    c.delete(v);
    return c;
  });

  if (vol <= 0) return members.filter((m): m is number[] => m !== null);

  const delta = (i: number, j: number): number => {
    const wij = adjW[i].get(j) ?? 0;
    const vM = volC[i] + volC[j];
    const gM = gC[i] + gC[j] - 2 * wij;
    const dL = (xlog2x(vM) - xlog2x(volC[i]) - xlog2x(volC[j])) / vol;
    const dS =
      -(gM * log2(vM / vol) - safeCutTerm(gC[i], volC[i], vol) - safeCutTerm(gC[j], volC[j], vol)) / vol;
    return dL + dS;
  };

  for (;;) {
    let best = -1e-12; // require a real decrease
    let bi = -1;
    let bj = -1;
    for (let i = 0; i < g.n; i++) {
      if (members[i] === null) continue;
      for (const j of adjW[i].keys()) {
        if (j <= i || members[j] === null) continue;
        const d = delta(i, j);
        if (d < best) {
          best = d;
          bi = i;
          bj = j;
        }
      }
    }
    if (bi < 0) break;

    // merge bj into bi
    members[bi] = [...members[bi]!, ...members[bj]!];
    const wij = adjW[bi].get(bj) ?? 0;
    volC[bi] += volC[bj];
    gC[bi] = gC[bi] + gC[bj] - 2 * wij;
    for (const [c, w] of adjW[bj]) {
      if (c === bi) continue;
      adjW[bi].set(c, (adjW[bi].get(c) ?? 0) + w);
      adjW[c].delete(bj);
      adjW[c].set(bi, (adjW[c].get(bi) ?? 0) + w);
    }
    adjW[bi].delete(bj);
    members[bj] = null;
  }

  return members.filter((m): m is number[] => m !== null);
}

/** A node of the encoding tree; leaves are single input vertices. */
export interface EncodingTreeNode {
  members: number[]; // all original vertices under this node
  children: EncodingTreeNode[]; // empty ⇒ leaf (single vertex)
}

/**
 * Build the full encoding tree by minimizing structural entropy bottom-up:
 * greedy-merge into communities, contract them into super-vertices, recurse. The
 * variable-depth hierarchy is the area tree (leaves = input vertices; when fed the
 * community graph, leaves = leaf areas and internal nodes = container areas).
 */
export function buildEncodingTree(g: WeightedGraph): EncodingTreeNode {
  let nodes: EncodingTreeNode[] = Array.from({ length: g.n }, (_, v) => ({ members: [v], children: [] }));
  let current = g;

  // Guard against pathological non-convergence; real graphs collapse in a few levels.
  for (let level = 0; level < g.n + 1; level++) {
    if (current.n <= 1) break;
    const partition = greedyPartition2D(current);
    if (partition.length === current.n) break; // no merge improves SE → done

    const superNodes: EncodingTreeNode[] = partition.map((group) => ({
      members: group.flatMap((idx) => nodes[idx].members),
      children: group.map((idx) => nodes[idx]),
    }));
    current = contract(current, partition);
    nodes = superNodes;
  }

  if (nodes.length === 1) return nodes[0];
  return { members: nodes.flatMap((n) => n.members), children: nodes };
}

/**
 * Structural entropy of an ARBITRARY encoding tree (general height formula):
 * H = -Σ_{α≠root} (g_α/vol) · log2(V_α / V_parent(α)). The monotonicity guard for
 * the rebuild compares this before/after.
 */
export function treeSe(root: EncodingTreeNode, g: WeightedGraph): number {
  const vol = volume(g);
  if (vol <= 0) return 0;
  let h = 0;
  const walk = (node: EncodingTreeNode, parentVol: number): void => {
    const vAlpha = communityVolume(g, node.members);
    if (parentVol > 0 && vAlpha > 0) {
      const gAlpha = communityCut(g, node.members);
      if (gAlpha > 0) h -= (gAlpha / vol) * log2(vAlpha / parentVol);
    }
    for (const child of node.children) walk(child, vAlpha);
  };
  // root contributes 0; descend into its children with V_root = vol
  for (const child of root.children) walk(child, vol);
  return h;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function communityVolume(g: WeightedGraph, members: readonly number[]): number {
  let v = 0;
  for (const u of members) v += degree(g, u);
  return v;
}

/** Weight of edges leaving the community (cut). */
function communityCut(g: WeightedGraph, members: readonly number[]): number {
  const inside = new Set(members);
  let cut = 0;
  for (const u of members) {
    for (const [v, w] of g.adj[u]) if (!inside.has(v)) cut += w;
  }
  return cut;
}

function safeCutTerm(gc: number, vc: number, vol: number): number {
  return gc > 0 && vc > 0 ? gc * log2(vc / vol) : 0;
}

/**
 * Contract a graph by a partition: super-vertex c = group c. Cross edges aggregate;
 * internal edges collapse into a SELF-LOOP of weight `V_c − g_c` so the super-vertex
 * keeps degree = V_c (its full volume, internal + external). This preserves vol(G)
 * across levels — without it, each super-vertex's degree would be only its cut, and
 * the next greedy level would minimize a volume-blind (cut-only) objective and pick
 * provably-worse groupings on trees ≥3 deep. (This recursive-contraction scheme is a
 * standard, near-optimal approximation of full multi-level SE minimization; the
 * `treeSe` oracle, which recomputes cuts/volumes on the ORIGINAL graph, remains exact.)
 */
function contract(g: WeightedGraph, partition: readonly number[][]): WeightedGraph {
  const of = new Array<number>(g.n).fill(-1);
  partition.forEach((group, c) => group.forEach((v) => (of[v] = c)));
  const adj: Map<number, number>[] = Array.from({ length: partition.length }, () => new Map());
  const vC = new Array<number>(partition.length).fill(0); // volume per super-vertex
  const gCut = new Array<number>(partition.length).fill(0); // external cut per super-vertex
  for (let u = 0; u < g.n; u++) {
    const cu = of[u];
    for (const [v, w] of g.adj[u]) {
      vC[cu] += w; // every incident endpoint (incl. an existing self-loop) adds to volume
      const cv = of[v];
      if (cu === cv) continue; // internal edge → folded into the self-loop below
      adj[cu].set(cv, (adj[cu].get(cv) ?? 0) + w);
      gCut[cu] += w;
    }
  }
  for (let c = 0; c < partition.length; c++) {
    const selfLoop = vC[c] - gCut[c]; // = 2·(internal weight), keeps degree = V_c
    if (selfLoop > 0) adj[c].set(c, selfLoop);
  }
  return { n: partition.length, adj };
}
