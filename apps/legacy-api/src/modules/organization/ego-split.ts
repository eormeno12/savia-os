import { connectedComponents } from './graph';

/**
 * Ego-splitting (Epasto, Lattanzi, Paes Leme — KDD 2017), the local half of the
 * framework. For one memory, its ego-net is the subgraph induced by its neighbors
 * (the ego itself removed). Partitioning that ego-net into connected components
 * decouples the memory's overlapping roles: each component becomes one *persona*,
 * a full-member instantiation of the memory in one community. A memory whose
 * neighbors fall into two disconnected worlds (e.g. "Python" and "Ana") gets two
 * personas → it belongs to both areas as a core member, not a border point. This
 * is the mechanism that yields LITERAL overlapping, co-located communities — the
 * thing a density partition (DBSCAN) collapses into one blob.
 *
 * Pure and local by construction: recomputing a memory's personas only needs its
 * ego-net, so the whole layer is incrementalizable (online).
 */

/** A persona = the set of the memory's neighbors that form one ego-net component. */
export type Persona = string[];

/**
 * Split a memory's ego-net into personas. `neighbors` are the memory's mutual-kNN
 * neighbors; `edgesAmongNeighbors` are the mutual edges BETWEEN those neighbors
 * (the ego excluded). Returns one neighbor-group per connected component. An empty
 * ego-net (a neighbor with no links to the others) yields one singleton persona
 * per isolated neighbor — faithful to the framework: unrelated neighbors are
 * genuinely different roles.
 */
export function egoSplit(neighbors: readonly string[], edgesAmongNeighbors: readonly [string, string][]): Persona[] {
  if (neighbors.length === 0) return [];
  const nb = new Set(neighbors);
  const adj = new Map<string, Set<string>>();
  for (const n of neighbors) adj.set(n, new Set());
  for (const [a, b] of edgesAmongNeighbors) {
    if (a === b || !nb.has(a) || !nb.has(b)) continue; // ignore edges touching non-neighbors
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  return connectedComponents(neighbors, (n) => adj.get(n) ?? []);
}

/**
 * Stable matching of freshly-recomputed personas to the memory's previous
 * personas, by descending Jaccard overlap of their neighbor sets. Greedy and
 * deterministic. Returns, for each new persona (by index), the matched old
 * persona id or `null` when it is genuinely new. Keeping persona identity stable
 * across recomputes is what stops `communityId` from churning on every edit.
 */
export function matchPersonas(
  oldPersonas: readonly { id: string; neighbors: readonly string[] }[],
  newPersonas: readonly Persona[],
): (string | null)[] {
  const pairs: { ni: number; oi: number; j: number }[] = [];
  const newSets = newPersonas.map((p) => new Set(p));
  oldPersonas.forEach((op, oi) => {
    const oldSet = new Set(op.neighbors);
    newSets.forEach((ns, ni) => {
      const j = jaccard(oldSet, ns);
      if (j > 0) pairs.push({ ni, oi, j });
    });
  });
  // Highest overlap first; ties broken deterministically by index for reproducibility.
  pairs.sort((x, y) => y.j - x.j || x.ni - y.ni || x.oi - y.oi);

  const result = new Array<string | null>(newPersonas.length).fill(null);
  const usedOld = new Set<number>();
  const takenNew = new Set<number>();
  for (const { ni, oi } of pairs) {
    if (takenNew.has(ni) || usedOld.has(oi)) continue;
    result[ni] = oldPersonas[oi].id;
    takenNew.add(ni);
    usedOld.add(oi);
  }
  return result;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
