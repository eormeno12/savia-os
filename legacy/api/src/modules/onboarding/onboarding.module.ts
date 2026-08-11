import { Inject, Injectable, Module } from '@nestjs/common';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ZodValidationPipe } from 'nestjs-zod';
import { ImportChatGptSchema, RescueTextSchema, UpdateProfileSchema } from '@savia-os/legacy-contracts';
import type { ImportChatGpt, RescueText, SuggestedSpace, UpdateProfileDto } from '@savia-os/legacy-contracts';
import { PrismaService } from '../../common/clients/prisma.service';
import { EntityGraphPort } from '../../common/ports/entity-graph.port';
import { MemoryService } from '../memory/memory.service';
import { MemoryModule } from '../memory/memory.module';
import { JobsService } from '../jobs/jobs.service';
import { JobsModule } from '../jobs/jobs.module';
import { IMPORT_QUEUE, ImportJobData, importQueueProvider } from '../import/import.queue';
import { parseChatGptExport } from './chatgpt.parser';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

const RESCUE_PROMPT = `Por favor, haz un resumen detallado de todo lo que sabes sobre mí a lo largo de nuestras conversaciones. Incluye trabajo, salud, relaciones, educación, intereses, objetivos, preferencias y cualquier dato relevante. Organízalo en hechos concretos, uno por línea, sin introducción ni conclusión.`;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: MemoryService,
    private readonly jobs: JobsService,
    private readonly entityGraph: EntityGraphPort,
    @Inject(IMPORT_QUEUE) private readonly importQueue: Queue<ImportJobData>,
  ) {}

  getRescuePrompt(): string {
    return RESCUE_PROMPT;
  }

  async setProfile(userId: string, displayName: string): Promise<{ displayName: string }> {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { displayName } });
    return { displayName: user.displayName! };
  }

  async ingestRescue(userId: string, text: string): Promise<{ count: number }> {
    const ids = await this.memory.add(userId, text, { source: 'rescue', sourceLabel: 'Prompt de rescate' });
    return { count: ids.length };
  }

  async importChatGpt(userId: string, rawJson: string): Promise<{ jobId: string; queued: number }> {
    const chunks = parseChatGptExport(rawJson);
    const job = await this.jobs.create(userId, 'import_chatgpt', chunks.length);
    await this.importQueue.add('import', { dbJobId: job.id, userId, chunks, source: 'chatgpt' }, { jobId: `import:${job.id}` });
    return { jobId: job.id, queued: chunks.length };
  }

  /** Suggest areas from the user's current memory, anchored on dominant entities. */
  async suggestSpaces(userId: string): Promise<SuggestedSpace[]> {
    const links = await this.entityGraph.linksForUser(userId);
    return links
      .filter((l) => l.memoryIds.length >= 3)
      .sort((a, b) => b.memoryIds.length - a.memoryIds.length)
      .slice(0, 8)
      .map((l) => ({
        name: l.entity.charAt(0).toUpperCase() + l.entity.slice(1),
        description: `Memorias relacionadas con ${l.entity}`,
        memoryCount: l.memoryIds.length,
        examples: [],
      }));
  }
}

@Controller('onboarding')
class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Post('profile')
  setProfile(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileDto) {
    return this.svc.setProfile(user.sub, dto.displayName);
  }

  @Get('rescue-prompt')
  rescuePrompt() {
    return { prompt: this.svc.getRescuePrompt() };
  }

  @Post('rescue')
  rescue(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(RescueTextSchema)) dto: RescueText) {
    return this.svc.ingestRescue(user.sub, dto.text);
  }

  @Post('import/chatgpt')
  importChatGpt(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(ImportChatGptSchema)) dto: ImportChatGpt) {
    return this.svc.importChatGpt(user.sub, dto.content);
  }

  @Get('suggest-spaces')
  suggestSpaces(@CurrentUser() user: JwtPayload) {
    return this.svc.suggestSpaces(user.sub);
  }
}

@Module({
  imports: [MemoryModule, JobsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, importQueueProvider],
  exports: [OnboardingService],
})
export class OnboardingModule {}
