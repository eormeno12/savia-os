import { Module } from '@nestjs/common';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Logger, Param, Post, Query } from '@nestjs/common';
import type { Lens } from '@prisma/client';
import { ZodValidationPipe } from 'nestjs-zod';
import { CreateLensSchema } from '@savia-os/contracts';
import type { CreateLensDto, LensDto, MemoryResult } from '@savia-os/contracts';
import { PrismaService } from '../../common/clients/prisma.service';
import { EmbeddingsPort } from '../../common/ports/embeddings.port';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { P } from '../../common/ports/predicate';
import { NotFoundError } from '../../common/errors/domain-error';
import { facetsOf, textOf } from '../../common/adapters/facets';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

const DEFAULT_RADIUS = 0.4; // cota coseno: atrae si score >= 1-radius
const LENS_CAP = 1000; // kNN generoso para aproximar la superficie completa; nunca un cap silencioso

/**
 * Lens = búsqueda guardada, personal, 100% en vivo: ni gobierna el árbol, ni
 * persiste membership, ni aparece en dashboards — corre la query (anchor/
 * radius + cota coseno, clamada a sourceAreaIds) en cada lectura y listo.
 */
@Injectable()
export class LensService {
  private readonly logger = new Logger(LensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsPort,
    private readonly vectors: VectorStorePort,
  ) {}

  async create(userId: string, dto: CreateLensDto): Promise<LensDto> {
    const [anchor] = await this.embeddings.embed([dto.query], { dims: 256 }).catch(() => [[]]);
    const lens = await this.prisma.lens.create({
      data: {
        userId,
        name: dto.name,
        query: dto.query,
        anchor: anchor ?? [],
        radius: dto.radius ?? DEFAULT_RADIUS,
        sourceAreaIds: dto.sourceAreaIds ?? [],
      },
    });
    return this.toDto(lens);
  }

  async list(userId: string): Promise<LensDto[]> {
    const lenses = await this.prisma.lens.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return lenses.map((l) => this.toDto(l));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.prisma.lens.deleteMany({ where: { id, userId } });
  }

  /** Owner's view: the lens IS the query — knn(anchor) + radius cutoff, nothing else. */
  async memories(userId: string, id: string, limit = 30): Promise<MemoryResult[]> {
    const lens = await this.prisma.lens.findFirst({ where: { id, userId } });
    if (!lens) throw new NotFoundError('Lente no encontrada');

    const hits = await this.surface(lens);
    return hits
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        text: textOf(p.payload),
        score: p.score ?? 0,
        areaIds: facetsOf(p.payload).areaIds ?? [],
        sensitivity: facetsOf(p.payload).sensitivity ?? 'normal',
      }));
  }

  /** The live surface of a lens: knn(anchor) clamped to sourceAreaIds, cut at the score floor. */
  private async surface(lens: Lens) {
    if (lens.anchor.length === 0) return [];

    // Empty sourceAreaIds → all of the lens owner's areas (owner-scoped `own` semantics).
    const basePredicate = P.own(lens.userId, { areaIds: lens.sourceAreaIds });

    const hits = await this.vectors.knn(lens.anchor, basePredicate, LENS_CAP);
    if (hits.length === LENS_CAP) this.logger.warn(`lens ${lens.id}: surface truncated at CAP=${LENS_CAP}`);
    const minScore = 1 - lens.radius;
    return hits.filter((h) => (h.score ?? 0) >= minScore);
  }

  private toDto(l: Lens): LensDto {
    return {
      id: l.id,
      name: l.name,
      query: l.query,
      radius: l.radius,
      sourceAreaIds: l.sourceAreaIds,
      createdAt: l.createdAt.toISOString(),
    };
  }
}

@Controller('lenses')
class LensesController {
  constructor(private readonly lenses: LensService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(CreateLensSchema)) dto: CreateLensDto) {
    return this.lenses.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.lenses.list(user.sub);
  }

  @Get(':id/memories')
  memories(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Query('limit') limit?: string) {
    return this.lenses.memories(user.sub, id, limit ? Number(limit) : 30);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.lenses.remove(user.sub, id);
  }
}

@Module({
  controllers: [LensesController],
  providers: [LensService],
  exports: [LensService],
})
export class LensesModule {}
