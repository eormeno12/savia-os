/**
 * Pure vector helpers. Embeddings are unit vectors (cosine space). Matryoshka:
 * a 1536d embedding truncated to its first 256 dims and renormalized stays a
 * meaningful (lower-fidelity) direction — we cluster in 256d, retrieve in 1536d.
 */

export function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

/** Project to unit length. Returns a zero vector unchanged (no NaN). */
export function renorm(a: number[]): number[] {
  const n = norm(a);
  if (n === 0) return a.slice();
  return a.map((x) => x / n);
}

/** Matryoshka truncation + renorm. dims ≥ a.length returns a renormed copy. */
export function truncate(a: number[], dims: number): number[] {
  return renorm(a.slice(0, dims));
}

/** Cosine similarity of two (not necessarily unit) vectors. */
export function cosine(a: number[], b: number[]): number {
  const d = norm(a) * norm(b);
  return d === 0 ? 0 : dot(a, b) / d;
}

export function add(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + (b[i] ?? 0));
}

export function sub(a: number[], b: number[]): number[] {
  return a.map((x, i) => x - (b[i] ?? 0));
}

export function scale(a: number[], k: number): number[] {
  return a.map((x) => x * k);
}

/** Centroid (mean) of vectors. Empty → []. */
export function mean(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const acc = vectors[0].slice();
  for (let i = 1; i < vectors.length; i++) {
    const v = vectors[i];
    for (let j = 0; j < acc.length; j++) acc[j] += v[j] ?? 0;
  }
  return acc.map((x) => x / vectors.length);
}
