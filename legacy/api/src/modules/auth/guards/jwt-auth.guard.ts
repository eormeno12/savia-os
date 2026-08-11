import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UnauthorizedError } from '../../../common/errors/domain-error';
import { JwtService } from '../jwt.service';
import { SessionService } from '../session.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload } from '../decorators/current-user.decorator';

/**
 * Global default-deny guard (F1.4 / SEC-2). Every route requires a valid access
 * cookie unless explicitly marked @Public(). A logged-out access jti (denylist)
 * is rejected immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload; cookies?: Record<string, string> }>();
    const token = req.cookies?.access_token;
    if (!token) throw new UnauthorizedError('No autorizado');

    const payload = await this.jwt.verifyAccess(token);
    if (await this.sessions.isAccessDenied(payload.jti)) throw new UnauthorizedError('Sesión cerrada');

    req.user = payload;
    return true;
  }
}
