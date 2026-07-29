import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  ConfirmMatchSchema,
  CreateGroupSchema,
  InviteSchema,
  ShareFragmentSchema,
  UpdateMemberRoleSchema,
} from '@savia-os/contracts';
import type {
  ConfirmMatchDto,
  CreateGroupDto,
  InviteDto,
  ShareFragmentDto,
  UpdateMemberRoleDto,
} from '@savia-os/contracts';
import { CollectiveService } from './collective.service';
import { FederationService } from './federation.service';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('groups')
export class CollectiveController {
  constructor(
    private readonly collective: CollectiveService,
    private readonly federation: FederationService,
  ) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(CreateGroupSchema)) dto: CreateGroupDto) {
    return this.collective.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.collective.list(user.sub);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.collective.get(user.sub, id);
  }

  @Post(':id/fragments')
  addFragment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ShareFragmentSchema)) dto: ShareFragmentDto,
  ) {
    return this.collective.addFragment(user.sub, id, dto);
  }

  @Get(':id/fragments')
  listFragments(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.collective.listFragments(user.sub, id);
  }

  @Delete(':id/fragments/:fragmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFragment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fragmentId', ParseUUIDPipe) fragmentId: string,
  ) {
    return this.collective.removeFragment(user.sub, id, fragmentId);
  }

  @Get(':id/fragments/:fragmentId/match-preview')
  previewMatch(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fragmentId', ParseUUIDPipe) fragmentId: string,
    @Query('limit') limit?: string,
  ) {
    // Kept optional (unlike `memories` below): a bad/missing limit should fall
    // through to previewMatch's own default (MATCH_PREVIEW_LIMIT), not a value
    // hardcoded here.
    const parsed = limit ? Number(limit) : NaN;
    return this.collective.previewMatch(user.sub, id, fragmentId, Number.isFinite(parsed) ? parsed : undefined);
  }

  @Post(':id/fragments/:fragmentId/match-confirm')
  confirmMatch(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fragmentId', ParseUUIDPipe) fragmentId: string,
    @Body(new ZodValidationPipe(ConfirmMatchSchema)) dto: ConfirmMatchDto,
  ) {
    return this.collective.confirmMatch(user.sub, id, fragmentId, dto);
  }

  @Post(':id/invites')
  invite(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(InviteSchema)) dto: InviteDto,
  ) {
    return this.collective.invite(user.sub, id, dto);
  }

  @Get(':id/members')
  members(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.collective.listMembers(user.sub, id);
  }

  @Patch(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateRole(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body(new ZodValidationPipe(UpdateMemberRoleSchema)) dto: UpdateMemberRoleDto,
  ) {
    return this.collective.updateMemberRole(user.sub, id, targetUserId, dto.role);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.collective.removeMember(user.sub, id, targetUserId);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.collective.leave(user.sub, id);
  }

  @Get(':id/memories')
  memories(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('q') q: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    // No `includeSensitive` param by design: sensitive memories never flow into the
    // group union view (the owner's private marker is not the viewer's to lift).
    return this.federation.search(id, user.sub, q ?? '', { limit });
  }
}
