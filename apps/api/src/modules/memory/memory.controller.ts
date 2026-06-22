import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { AddMemorySchema, MemorySearchQuerySchema } from '@savia-os/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { MemoryService } from './memory.service';

class AddMemoryDto extends createZodDto(AddMemorySchema) {}
class MemorySearchDto extends createZodDto(MemorySearchQuerySchema) {}

@Controller('memory')
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Post('add')
  add(@Body() dto: AddMemoryDto, @CurrentUser() user: JwtPayload) {
    return this.memory.add(user.sub, dto.text, { fileId: dto.fileId, source: dto.source });
  }

  @Post('search')
  search(@Body() dto: MemorySearchDto, @CurrentUser() user: JwtPayload) {
    return this.memory.search(user.sub, dto.query, {
      submemories: dto.submemories,
      limit: dto.limit,
    });
  }

  @Delete(':id')
  deleteOne(@Param('id') id: string) {
    return this.memory.deleteByMemoryId(id);
  }
}
