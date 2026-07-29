import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { MailService } from './mail.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CookieHelper } from './cookies';
import { AppConfig } from '../../common/config/app.config';

/**
 * Auth. Provides the global default-deny guard (APP_GUARD) so every route is
 * protected unless @Public(). JwtService + SessionService are exported for the
 * MCP edge / other guards.
 */
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    MailService,
    JwtService,
    SessionService,
    JwtAuthGuard,
    { provide: CookieHelper, useFactory: (c: AppConfig) => new CookieHelper(c), inject: [AppConfig] },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [JwtService, SessionService],
})
export class AuthModule {}
