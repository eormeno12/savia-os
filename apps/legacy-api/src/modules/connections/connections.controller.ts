import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { CreateConnectionSchema, CreateGrantSchema } from '@savia-os/contracts';
import type { CreateConnectionDto, CreateGrantDto } from '@savia-os/contracts';
import { ConnectionsService } from './connections.service';
import { RequirePlan, RequirePlanGuard } from '../billing/require-plan.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  // Connecting an AI is a Pro capability (server-side freemium, not the modal).
  @Post()
  @UseGuards(RequirePlanGuard)
  @RequirePlan('pro')
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateConnectionSchema)) dto: CreateConnectionDto,
  ) {
    return this.connections.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.connections.findAll(user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.connections.revoke(user.sub, id);
  }

  @Post(':id/grants')
  addGrant(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateGrantSchema)) dto: CreateGrantDto,
  ) {
    return this.connections.addGrant(user.sub, id, dto);
  }

  @Delete(':id/grants/:grantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGrant(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('grantId', ParseUUIDPipe) grantId: string,
  ) {
    return this.connections.removeGrant(user.sub, id, grantId);
  }
}
