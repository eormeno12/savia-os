import { Injectable } from '@nestjs/common';
import { QdrantService } from '../../common/clients/qdrant.service';

interface MemoryPoint {
  id: string;
  text: string;
  vector: number[];
}

export interface SpaceSuggestion {
  name: string;
  description: string;
  memoryCount: number;
  examples: string[];
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function addVectors(acc: number[], v: number[]): number[] {
  return acc.map((x, i) => x + v[i]);
}

function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

function kMeans(points: MemoryPoint[], k: number): MemoryPoint[][] {
  const n = points.length;
  if (n <= k) return points.map((p) => [p]);

  // K-means++ init: spread initial centroids
  const centroidIndices: number[] = [Math.floor(Math.random() * n)];
  while (centroidIndices.length < k) {
    const dists = points.map((p) => {
      const best = centroidIndices.reduce((minD, ci) => {
        const d = 1 - dot(p.vector, points[ci].vector);
        return Math.min(minD, d);
      }, Infinity);
      return best * best;
    });
    const total = dists.reduce((s, d) => s + d, 0);
    let r = Math.random() * total;
    let chosen = 0;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) { chosen = i; break; }
    }
    centroidIndices.push(chosen);
  }

  let centroids = centroidIndices.map((i) => [...points[i].vector]);
  let assignments = new Array<number>(n).fill(0);

  for (let iter = 0; iter < 25; iter++) {
    // Assign
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestK = 0;
      let bestSim = -Infinity;
      for (let j = 0; j < k; j++) {
        const sim = dot(points[i].vector, centroids[j]);
        if (sim > bestSim) { bestSim = sim; bestK = j; }
      }
      if (assignments[i] !== bestK) { assignments[i] = bestK; changed = true; }
    }
    if (!changed) break;

    // Update centroids
    for (let j = 0; j < k; j++) {
      const clusterVecs = points
        .filter((_, i) => assignments[i] === j)
        .map((p) => p.vector);
      if (clusterVecs.length === 0) continue;
      const sum = clusterVecs.reduce(addVectors, new Array(clusterVecs[0].length).fill(0));
      centroids[j] = normalizeVector(sum);
    }
  }

  // Group points by cluster
  const clusters: MemoryPoint[][] = Array.from({ length: k }, () => []);
  points.forEach((p, i) => clusters[assignments[i]].push(p));
  return clusters.filter((c) => c.length > 0);
}

@Injectable()
export class ClusterService {
  constructor(private readonly qdrant: QdrantService) {}

  async fetchPoints(userId: string, maxPoints = 500): Promise<MemoryPoint[]> {
    const points: MemoryPoint[] = [];
    let offset: string | null = null;

    do {
      const resp = await (this.qdrant as any).scroll(this.qdrant.collectionName, {
        filter: {
          must: [{ key: 'user_id', match: { value: userId } }],
        },
        with_vector: true,
        with_payload: true,
        limit: 100,
        ...(offset ? { offset } : {}),
      });

      const result = resp as any;
      const batch: any[] = result.points ?? result?.result?.points ?? [];

      for (const pt of batch) {
        const text = pt.payload?.mem0_data ?? pt.payload?.text ?? '';
        const vector = Array.isArray(pt.vector) ? pt.vector : null;
        if (vector && text) {
          points.push({ id: String(pt.id), text, vector });
        }
      }

      offset = result.next_page_offset ?? result?.result?.next_page_offset ?? null;
    } while (offset && points.length < maxPoints);

    return points;
  }

  async suggestSpaces(userId: string): Promise<SpaceSuggestion[]> {
    const points = await this.fetchPoints(userId);
    if (points.length < 3) return [];

    const k = Math.min(Math.round(Math.sqrt(points.length)), 8);
    const clusters = kMeans(points, k);

    const { OpenAI } = await import('openai');
    const openai = new OpenAI();

    const suggestions = await Promise.all(
      clusters.map(async (cluster) => {
        // Pick 5 closest to centroid as examples
        const sum = cluster.map((p) => p.vector).reduce(addVectors, new Array(cluster[0].vector.length).fill(0));
        const centroid = normalizeVector(sum);
        const sorted = [...cluster].sort((a, b) => dot(b.vector, centroid) - dot(a.vector, centroid));
        const examples = sorted.slice(0, 3).map((p) => p.text.slice(0, 120));
        const sample = sorted.slice(0, 5).map((p) => `- ${p.text.slice(0, 200)}`).join('\n');

        const resp = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content:
                'Eres un asistente que nombra categorías de memoria personal. Responde SOLO con JSON válido: {"name":"...","description":"..."}. El name debe ser 1-3 palabras, la description 1 oración.',
            },
            {
              role: 'user',
              content: `Aquí hay un grupo de recuerdos relacionados:\n${sample}\n\nNombra este espacio de memoria.`,
            },
          ],
        });

        let name = 'Espacio';
        let description = 'Memorias relacionadas';
        try {
          const parsed = JSON.parse(resp.choices[0].message.content ?? '{}');
          name = parsed.name ?? name;
          description = parsed.description ?? description;
        } catch {
          // Keep defaults
        }

        return {
          name,
          description,
          memoryCount: cluster.length,
          examples,
        } satisfies SpaceSuggestion;
      }),
    );

    return suggestions.filter((s) => s.memoryCount >= 2);
  }
}
