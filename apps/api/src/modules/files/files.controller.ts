import { Body, Controller, Delete, Get, Param, Post, UseGuards, HttpCode } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { PresignRequestSchema, CreateFileSchema } from '@savia-os/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { FilesService } from './files.service';

class PresignRequestDto extends createZodDto(PresignRequestSchema) {}
class CreateFileDto extends createZodDto(CreateFileSchema) {}

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('presign')
  presign(@Body() dto: PresignRequestDto, @CurrentUser() user: JwtPayload) {
    return this.files.presign(user.sub, dto.name, dto.mimeType, dto.sizeBytes);
  }

  @Post()
  create(@Body() dto: CreateFileDto, @CurrentUser() user: JwtPayload) {
    return this.files.create(user.sub, dto.name, dto.mimeType, dto.sizeBytes, dto.s3Key);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.files.list(user.sub);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.files.get(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.files.delete(user.sub, id);
  }
}
