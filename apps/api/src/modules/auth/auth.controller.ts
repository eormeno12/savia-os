import { Body, Controller, Get, Post, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { Request, Response } from 'express';
import { RequestOtpSchema, VerifyOtpSchema } from '@savia-os/contracts';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from './decorators/current-user.decorator';

class RequestOtpDto extends createZodDto(RequestOtpSchema) {}
class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-otp')
  @HttpCode(200)
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? '0.0.0.0';
    await this.auth.requestOtp(dto.email, ip);
    return { message: 'Código enviado.' };
  }

  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.verifyOtp(dto.email, dto.code, res);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: string = req.cookies?.refresh_token;
    await this.auth.refresh(token, res);
    return { message: 'Token renovado.' };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.clearCookies(res);
    return { message: 'Sesión cerrada.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtPayload) {
    return { id: user.sub, email: user.email };
  }
}
