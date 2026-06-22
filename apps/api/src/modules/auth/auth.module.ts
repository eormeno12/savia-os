import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { MailService } from './mail.service';
import { JwtService } from './jwt.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../../common/clients/prisma.service';
import { RedisService } from '../../common/clients/redis.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    MailService,
    JwtService,
    JwtAuthGuard,
    PrismaService,
    RedisService,
  ],
  exports: [JwtService, JwtAuthGuard],
})
export class AuthModule {}
