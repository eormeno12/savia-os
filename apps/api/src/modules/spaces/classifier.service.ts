import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../common/clients/prisma.service';
import { QdrantService } from '../../common/clients/qdrant.service';

const THRESHOLD_AUTO_ASSIGN = parseFloat(process.env.CLASSIFY_THRESHOLD_AUTO ?? '0.75');
const THRESHOLD_CANDIDATE = parseFloat(process.env.CLASSIFY_THRESHOLD_CANDIDATE ?? '0.45');
const BACKFILL_TOP_K = 200;

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

interface SpaceRef {
  id: string;
  name: string;
  descriptionEmbedding: number[];
  version: number;
}

@Injectable()
export class ClassifierService {
  private readonly logger = new Logger(ClassifierService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly qdrant: QdrantService,
    private readonly config: ConfigService,
  ) {
    this.openai = new OpenAI({ apiKey: config.get<string>('OPENAI_API_KEY', '') });
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return res.data[0].embedding;
  }

  /**
   * Classify one memory against all user spaces. Returns assigned space IDs.
   * Cost: O(spaces) cosine comparisons + at most 1 LLM call for ambiguous candidates.
   */
  async classifyOne(
    memoryId: string,
    memoryEmbedding: number[],
    userId: string,
  ): Promise<string[]> {
    const spaces = await this.getUserSpaces(userId);
    if (spaces.length === 0) return [];

    const autoAssigned: SpaceRef[] = [];
    const candidates: SpaceRef[] = [];

    for (const space of spaces) {
      const sim = cosine(memoryEmbedding, space.descriptionEmbedding);
      if (sim >= THRESHOLD_AUTO_ASSIGN) autoAssigned.push(space);
      else if (sim >= THRESHOLD_CANDIDATE) candidates.push(space);
    }

    let llmAssigned: SpaceRef[] = [];
    if (candidates.length > 0) {
      // Fetch memory text from Qdrant for LLM evaluation
      const hits = await this.qdrant.retrieve(this.qdrant.collectionName, {
        ids: [memoryId],
        with_payload: true,
      });
      const text = String((hits[0]?.payload as any)?.data ?? '');
      if (text) llmAssigned = await this.askLlmWhichSpaces(text, candidates);
    }

    const assignedIds = [...autoAssigned, ...llmAssigned].map((s) => s.id);
    if (assignedIds.length > 0) {
      await this.applyToMemory(memoryId, assignedIds, spaces);
    }
    return assignedIds;
  }

  /**
   * Backfill: find top-K memories in Qdrant that match this space and tag them.
   * Cost: 1 Qdrant search + at most 1 LLM batch call for ambiguous hits.
   */
  async backfill(spaceId: string, userId: string): Promise<number> {
    const space = await this.prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) return 0;

    const hits = await this.qdrant.searchVectors(
      space.descriptionEmbedding as number[],
      { must: [{ key: 'user_id', match: { value: userId } }] },
      BACKFILL_TOP_K,
    );

    const allSpaces = await this.getUserSpaces(userId);
    let assigned = 0;

    const autoIds: string[] = [];
    const candidateHits: typeof hits = [];

    for (const hit of hits) {
      if (hit.score >= THRESHOLD_AUTO_ASSIGN) autoIds.push(String(hit.id));
      else if (hit.score >= THRESHOLD_CANDIDATE) candidateHits.push(hit);
    }

    for (const id of autoIds) {
      await this.applyToMemory(id, [spaceId], allSpaces, true);
      assigned++;
    }

    // LLM batch: evaluate each candidate memory individually against this space
    for (const hit of candidateHits) {
      const text = String((hit.payload as any)?.data ?? '');
      if (!text) continue;
      const belongs = await this.askLlmOneMemoryOneSpace(text, space);
      if (belongs) {
        await this.applyToMemory(String(hit.id), [spaceId], allSpaces, true);
        assigned++;
      }
    }

    this.logger.log(`backfill spaceId=${spaceId} → ${assigned} memories assigned`);
    return assigned;
  }

  private async getUserSpaces(userId: string): Promise<SpaceRef[]> {
    const rows = await this.prisma.space.findMany({
      where: { userId },
      select: { id: true, name: true, descriptionEmbedding: true, version: true },
    });
    return rows.map((r) => ({
      ...r,
      descriptionEmbedding: r.descriptionEmbedding as number[],
    }));
  }

  /** Ask LLM which of the candidate spaces a memory text belongs to. Returns SpaceRef[]. */
  private async askLlmWhichSpaces(text: string, candidates: SpaceRef[]): Promise<SpaceRef[]> {
    const spaceList = candidates.map((s) => `- ${s.name}: ${s.id}`).join('\n');
    const prompt =
      `Determina si este recuerdo pertenece a alguno de estos espacios.\n\n` +
      `Recuerdo: "${text}"\n\nEspacios:\n${spaceList}\n\n` +
      `Responde SOLO con los IDs de los espacios donde encaja, separados por coma. ` +
      `Si ninguno aplica, responde NINGUNO.`;

    try {
      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0,
      });
      const answer = res.choices[0]?.message?.content?.trim() ?? '';
      if (answer === 'NINGUNO') return [];
      const confirmedIds = answer.split(',').map((s) => s.trim());
      return candidates.filter((sp) => confirmedIds.includes(sp.id));
    } catch (err: any) {
      this.logger.warn(`LLM classify failed: ${err.message}`);
      return [];
    }
  }

  /** Ask LLM if a single memory belongs to a single space. */
  private async askLlmOneMemoryOneSpace(text: string, space: SpaceRef): Promise<boolean> {
    const prompt =
      `¿Este recuerdo pertenece al espacio "${space.name}" (${space.id})?\n\n` +
      `Recuerdo: "${text}"\n\n` +
      `Responde únicamente SÍ o NO.`;

    try {
      const res = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 5,
        temperature: 0,
      });
      const answer = res.choices[0]?.message?.content?.trim().toUpperCase() ?? '';
      return answer.startsWith('SÍ') || answer.startsWith('SI');
    } catch (err: any) {
      this.logger.warn(`LLM backfill classify failed: ${err.message}`);
      return false;
    }
  }

  private async applyToMemory(
    memoryId: string,
    newSpaceIds: string[],
    allSpaces: SpaceRef[],
    backfill = false,
  ): Promise<void> {
    const row = await this.prisma.memoryIndex.findUnique({ where: { memoryId } });
    if (!row) return;
    if (backfill && row.manualOverride) return;

    const existing = row.spaceIds as string[];
    const merged = Array.from(new Set([...existing, ...newSpaceIds]));
    const versions: Record<string, number> = (row.spaceVersions as Record<string, number>) ?? {};
    for (const sid of newSpaceIds) {
      const space = allSpaces.find((s) => s.id === sid);
      if (space) versions[sid] = space.version;
    }

    await this.prisma.memoryIndex.update({
      where: { memoryId },
      data: { spaceIds: merged, spaceVersions: versions },
    });

    await this.qdrant.setPayload(this.qdrant.collectionName, {
      payload: { submemories: merged },
      points: [memoryId],
    });
  }
}
