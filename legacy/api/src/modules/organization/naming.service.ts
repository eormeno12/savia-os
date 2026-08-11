import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/clients/prisma.service';
import { LlmPort } from '../../common/ports/llm.port';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { P } from '../../common/ports/predicate';
import { facetsOf, textOf } from '../../common/adapters/facets';

/**
 * Names an area by its dominant entity (free, stable); falls back to a batched
 * LLM call only when no entity dominates (08 §4.8). Never on a hot path.
 */
@Injectable()
export class NamingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmPort,
    private readonly vectors: VectorStorePort,
  ) {}

  async nameArea(userId: string, areaId: string): Promise<void> {
    const page = await this.vectors.scroll(
      P.own(userId, { areaIds: [areaId] }),
      { limit: 200 },
    );
    const counts = new Map<string, number>();
    for (const p of page.points) {
      for (const e of facetsOf(p.payload).entities ?? []) counts.set(e, (counts.get(e) ?? 0) + 1);
    }

    let name: string | null = null;
    let anchors: string[] = [];
    if (counts.size > 0) {
      const sorted = [...counts].sort((a, b) => b[1] - a[1]);
      anchors = sorted.slice(0, 3).map(([e]) => e);
      name = capitalize(sorted[0][0]);
    } else {
      const sample = page.points.slice(0, 8).map((p) => textOf(p.payload)).filter(Boolean);
      if (sample.length) {
        name = await this.llm
          .complete(`Nombre corto (1-3 palabras, sin comillas) para este grupo de notas:\n${sample.join('\n')}\nResponde SOLO el nombre.`, { maxTokens: 32, temperature: 0 })
          .then((s) => s.trim().replace(/^["']|["']$/g, '').slice(0, 60))
          .catch(() => null);
      }
    }

    if (name) {
      await this.prisma.space.update({ where: { id: areaId }, data: { name, anchorEntities: anchors } });
    } else if (anchors.length) {
      await this.prisma.space.update({ where: { id: areaId }, data: { anchorEntities: anchors } });
    }
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
