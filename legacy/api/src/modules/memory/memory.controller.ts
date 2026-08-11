import { Body, Controller, Delete, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { AddMemorySchema, MemorySearchSchema, UpdateMemorySchema } from '@savia-os/legacy-contracts';
import type { AddMemoryDto, MemorySearchDto, UpdateMemoryDto } from '@savia-os/legacy-contracts';
import { MemoryService } from './memory.service';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async add(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(AddMemorySchema)) dto: AddMemoryDto,
  ) {
    const ids = await this.memory.add(user.sub, dto.text, { source: 'manual', areaId: dto.areaId });
    return { stored: ids.length, ids };
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  search(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(MemorySearchSchema)) dto: MemorySearchDto,
  ) {
    return this.memory.searchPersonal(user.sub, dto.query, dto.areaIds, dto.limit);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.memory.deleteOwn(user.sub, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateMemorySchema)) dto: UpdateMemoryDto,
  ) {
    return this.memory.update(user.sub, id, dto);
  }
}
