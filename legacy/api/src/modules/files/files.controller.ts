import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { CreateFileSchema, PresignRequestSchema } from '@savia-os/legacy-contracts';
import type { CreateFileDto, PresignRequest } from '@savia-os/legacy-contracts';
import { FilesService } from './files.service';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('presign')
  presign(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(PresignRequestSchema)) dto: PresignRequest) {
    return this.files.presign(user.sub, dto);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(CreateFileSchema)) dto: CreateFileDto) {
    return this.files.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query('areaId') areaId?: string) {
    return this.files.list(user.sub, areaId);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.get(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.files.delete(user.sub, id);
  }
}
