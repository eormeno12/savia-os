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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
    @CurrentUser('sub') userId: string,
    @Body(new ZodValidationPipe(CreateSpaceSchema)) dto: CreateSpaceDto,
  ) {
    return this.spaces.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('sub') userId: string) {
    return this.spaces.findAll(userId);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSpaceSchema)) dto: UpdateSpaceDto,
  ) {
    return this.spaces.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.spaces.remove(userId, id);
  }

  @Get(':id/memories')
  getMemories(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.spaces.getMemories(userId, id, cursor, limit);
  }

  @Delete(':id/memories/:memoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMemory(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('memoryId') memoryId: string,
  ) {
    return this.spaces.removeMemoryFromSpace(userId, id, memoryId);
  }

  @Post(':id/memories/:memoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  addMemory(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('memoryId') memoryId: string,
  ) {
    return this.spaces.addMemoryToSpace(userId, id, memoryId);
  }
}
