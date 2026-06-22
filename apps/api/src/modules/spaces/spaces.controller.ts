import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SpacesService } from './spaces.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  CreateSpaceSchema,
  UpdateSpaceSchema,
  type CreateSpaceDto,
  type UpdateSpaceDto,
} from '@savia-os/contracts';

@UseGuards(JwtAuthGuard)
@Controller('spaces')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(CreateSpaceSchema)) dto: CreateSpaceDto,
  ) {
    return this.spaces.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.spaces.findAll(user.sub);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSpaceSchema)) dto: UpdateSpaceDto,
  ) {
    return this.spaces.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.spaces.remove(user.sub, id);
  }

  @Get(':id/memories')
  getMemories(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.spaces.getMemories(user.sub, id, cursor, limit);
  }

  @Delete(':id/memories/:memoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMemory(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('memoryId') memoryId: string,
  ) {
    return this.spaces.removeMemoryFromSpace(user.sub, id, memoryId);
  }

  @Post(':id/memories/:memoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  addMemory(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('memoryId') memoryId: string,
  ) {
    return this.spaces.addMemoryToSpace(user.sub, id, memoryId);
  }
}
