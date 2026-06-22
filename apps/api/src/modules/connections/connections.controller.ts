import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  CreateConnectionSchema,
  GrantSchema,
  type CreateConnectionDto,
  type GrantDto,
} from '@savia-os/contracts';

@UseGuards(JwtAuthGuard)
@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Post()
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
  revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.connections.revoke(user.sub, id);
  }

  @Post(':id/grants')
  @HttpCode(HttpStatus.NO_CONTENT)
  addGrant(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(GrantSchema)) dto: GrantDto,
  ) {
    return this.connections.addGrant(user.sub, id, dto.spaceId);
  }

  @Delete(':id/grants/:spaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGrant(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('spaceId') spaceId: string,
  ) {
    return this.connections.removeGrant(user.sub, id, spaceId);
  }
}
