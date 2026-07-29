import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createZodDto } from 'nestjs-zod';
import { Request, Response } from 'express';
import { RequestOtpSchema, VerifyOtpSchema } from '@savia-os/contracts';
import { clientIp } from '../../common/http/client-ip';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser, JwtPayload } from './decorators/current-user.decorator';

class RequestOtpDto extends createZodDto(RequestOtpSchema) {}
class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('request-otp')
  @HttpCode(200)
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    await this.auth.requestOtp(dto.email, clientIp(req));
    return { message: 'Código enviado.' };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.verifyOtp(dto.email, dto.code, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.refresh(req.cookies?.refresh_token, res);
    return { message: 'Token renovado.' };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.access_token, req.cookies?.refresh_token, res);
    return { message: 'Sesión cerrada.' };
  }

  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }
}
