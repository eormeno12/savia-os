import { Controller, Get, HttpCode, HttpStatus, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import type { Notification, Suggestion } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { JobsModule } from '../jobs/jobs.module';
import { SuggestionsService } from '../organization/suggestions.service';
import { OrganizationModule } from '../organization/organization.module';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import type { InboxItem, SuggestionDto } from '@savia-os/contracts';

/**
 * The unified Bandeja (05 §3): one polymorphic feed over Notifications, plus the
 * Jobs and Suggestions surfaces — not three disjoint endpoints.
 */
@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suggestions: SuggestionsService,
  ) {}

  async list(userId: string, unseenOnly = false): Promise<InboxItem[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId, ...(unseenOnly ? { seenAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return notifications.map((n) => this.toItem(n));
  }

  async markSeen(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { id, userId, seenAt: null }, data: { seenAt: new Date() } });
  }

  async suggestionsList(userId: string): Promise<SuggestionDto[]> {
    const list = await this.suggestions.list(userId, 'pending');
    return list.map((s) => this.toSuggestionDto(s));
  }

  private toItem(n: Notification): InboxItem {
    return {
      id: n.id,
      kind: n.kind,
      refId: n.refId,
      data: (n.data as Record<string, unknown>) ?? {},
      seen: n.seenAt !== null,
      createdAt: n.createdAt.toISOString(),
    };
  }

  private toSuggestionDto(s: Suggestion): SuggestionDto {
    return {
      id: s.id,
      kind: s.kind,
      status: s.status,
      rationale: s.rationale,
      payload: (s.payload as Record<string, unknown>) ?? {},
      createdAt: s.createdAt.toISOString(),
    };
  }
}

@Controller()
class InboxController {
  constructor(
    private readonly inbox: InboxService,
    private readonly jobs: JobsService,
    private readonly suggestions: SuggestionsService,
  ) {}

  @Get('inbox')
  list(@CurrentUser() user: JwtPayload, @Query('unseen') unseen?: string) {
    return this.inbox.list(user.sub, unseen === 'true');
  }

  @Post('inbox/:id/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  seen(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.inbox.markSeen(user.sub, id);
  }

  @Get('jobs')
  jobs_(@CurrentUser() user: JwtPayload) {
    return this.jobs.list(user.sub);
  }

  @Get('jobs/:id')
  job(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.jobs.get(user.sub, id);
  }

  @Get('suggestions')
  suggestionsList(@CurrentUser() user: JwtPayload) {
    return this.inbox.suggestionsList(user.sub);
  }

  @Post('suggestions/:id/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  accept(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.suggestions.accept(user.sub, id);
  }

  @Post('suggestions/:id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  dismiss(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.suggestions.dismiss(user.sub, id);
  }
}

@Module({
  imports: [JobsModule, OrganizationModule],
  controllers: [InboxController],
  providers: [InboxService],
})
export class InboxModule {}
