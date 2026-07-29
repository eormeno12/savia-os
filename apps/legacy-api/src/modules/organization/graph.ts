/**
 * Pure graph primitives shared by the engine's math layer (ego-split,
 * community-ops, structural-entropy). No DI, no IO — same discipline as the old
 * `cluster-math.ts`, so every property is a unit assertion.
 */

/** An undirected weighted graph over vertices `0..n-1`, symmetric adjacency. */
export interface WeightedGraph {
  n: number;
  /** adj[u] = Map(v → weight), stored symmetrically (adj[u][v] === adj[v][u]). */
  adj: Map<number, number>[];
}

export function emptyGraph(n: number): WeightedGraph {
  return { n, adj: Array.from({ length: n }, () => new Map<number, number>()) };
}

/** Add (or accumulate) an undirected edge. Self-loops are ignored. */
export function addEdge(g: WeightedGraph, u: number, v: number, w: number): void {
  if (u === v || w === 0) return;
  g.adj[u].set(v, (g.adj[u].get(v) ?? 0) + w);
  g.adj[v].set(u, (g.adj[v].get(u) ?? 0) + w);
}

/** Build a WeightedGraph from an edge list over `n` vertices. */
export function graphFromEdges(n: number, edges: readonly { a: number; b: number; w: number }[]): WeightedGraph {
  const g = emptyGraph(n);
  for (const e of edges) addEdge(g, e.a, e.b, e.w);
  return g;
}

/** Weighted degree (volume contribution) of a vertex. */
export function degree(g: WeightedGraph, v: number): number {
  let d = 0;
  for (const w of g.adj[v].values()) d += w;
  return d;
}

/** vol(G) = Σ degrees = 2 · (total edge weight). */
export function volume(g: WeightedGraph): number {
  let vol = 0;
  for (let v = 0; v < g.n; v++) vol += degree(g, v);
  return vol;
}

/**
 * Connected components of an adjacency map keyed by arbitrary node ids. Returns
 * the components as arrays of ids; every node in `nodes` appears in exactly one
 * component (isolated nodes → singleton components). This is the local primitive
 * ego-splitting uses on an ego-net: each component becomes one persona.
 */
export function connectedComponents<T>(nodes: readonly T[], neighborsOf: (n: T) => Iterable<T>): T[][] {
  const index = new Map<T, number>();
  nodes.forEach((n, i) => index.set(n, i));
  const seen = new Array<boolean>(nodes.length).fill(false);
  const out: T[][] = [];

  for (let i = 0; i < nodes.length; i++) {
    if (seen[i]) continue;
    const comp: T[] = [];
    const stack = [i];
    seen[i] = true;
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(nodes[cur]);
      for (const nb of neighborsOf(nodes[cur])) {
        const j = index.get(nb);
        if (j === undefined || seen[j]) continue;
        seen[j] = true;
        stack.push(j);
      }
    }
    out.push(comp);
  }
  return out;
}
