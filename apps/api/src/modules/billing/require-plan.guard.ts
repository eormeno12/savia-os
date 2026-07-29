import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../common/clients/prisma.service';
import { ForbiddenError } from '../../common/errors/domain-error';
import type { JwtPayload } from '../auth/decorators/current-user.decorator';

export const REQUIRE_PLAN_KEY = 'requirePlan';

/** Gate a route behind a paid plan (server-side freemium — not the modal). */
export const RequirePlan = (plan: 'pro') => SetMetadata(REQUIRE_PLAN_KEY, plan);

/**
 * Applied AFTER the global JwtAuthGuard (so req.user is set). Reads the
 * materialized `User.plan` — O(1) — and rejects when it doesn't meet the
 * requirement. Dropping to `free` cuts access here without touching data.
 */
@Injectable()
export class RequirePlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<'pro' | undefined>(REQUIRE_PLAN_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;
    const req = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!req.user) throw new ForbiddenError('No autorizado');
    const user = await this.prisma.user.findUnique({ where: { id: req.user.sub }, select: { plan: true } });
    if (user?.plan !== required) throw new ForbiddenError(`Requiere plan ${required}`, 'PlanRequired');
    return true;
  }
}
