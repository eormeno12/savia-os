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
import { CreateAreaSchema, UpdateAreaSchema } from '@savia-os/legacy-contracts';
import type { CreateAreaDto, UpdateAreaDto } from '@savia-os/legacy-contracts';
import { AreasService } from './areas.service';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

const MAX_SAMPLE = 50;

@Controller('areas')
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  @Get('tree')
  tree(@CurrentUser() user: JwtPayload) {
    return this.areas.tree(user.sub);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.areas.list(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(CreateAreaSchema)) dto: CreateAreaDto) {
    return this.areas.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateAreaSchema)) dto: UpdateAreaDto,
  ) {
    return this.areas.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.areas.remove(user.sub, id);
  }

  @Get(':id/memories')
  memories(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Query('cursor') cursor?: string) {
    return this.areas.memories(user.sub, id, cursor);
  }

  @Get(':id/sample')
  sample(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('n', new DefaultValuePipe(3), ParseIntPipe) n: number,
  ) {
    return this.areas.sample(user.sub, id, Math.min(Math.max(n, 1), MAX_SAMPLE));
  }
}
