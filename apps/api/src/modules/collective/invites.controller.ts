import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CollectiveService } from './collective.service';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('invites')
export class InvitesController {
  constructor(private readonly collective: CollectiveService) {}

  /** Bandeja: pending invites for the caller's own verified email. */
  @Get()
  listPending(@CurrentUser() user: JwtPayload) {
    return this.collective.listPendingInvites(user.email);
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUser() user: JwtPayload, @Param('token') token: string) {
    return this.collective.acceptInvite(user.sub, user.email, token);
  }
}
