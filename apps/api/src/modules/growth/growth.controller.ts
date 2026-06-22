import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GrowthService } from './growth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('growth')
export class GrowthController {
  constructor(private readonly growth: GrowthService) {}

  @Get('areas')
  getAreas(@CurrentUser() user: JwtPayload) {
    return this.growth.getAreas(user.sub);
  }

  @Get()
  getGrowth(
    @CurrentUser() user: JwtPayload,
    @Query('range') range: 'day' | 'week' = 'week',
  ) {
    const r = range === 'day' ? 'day' : 'week';
    return this.growth.getGrowth(user.sub, r);
  }

  @Get('access-activity')
  getAccessActivity(@CurrentUser() user: JwtPayload) {
    return this.growth.getAccessActivity(user.sub);
  }
}
