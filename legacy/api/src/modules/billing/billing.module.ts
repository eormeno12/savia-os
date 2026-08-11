import { createHmac, timingSafeEqual } from 'node:crypto';
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Module, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { StartSubscriptionSchema } from '@savia-os/legacy-contracts';
import type { StartSubscriptionDto } from '@savia-os/legacy-contracts';
import { AppConfig } from '../../common/config/app.config';
import { UnauthorizedError } from '../../common/errors/domain-error';
import { BillingService } from './billing.service';
import { MercadoPagoPort } from './mercadopago.port';
import { MercadoPagoHttpAdapter } from './mercadopago.adapter';
import { RequirePlanGuard } from './require-plan.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('billing')
class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('subscription')
  create(@CurrentUser() user: JwtPayload, @Body(new ZodValidationPipe(StartSubscriptionSchema)) dto: StartSubscriptionDto) {
    return this.billing.createSubscription(user.sub, user.email, dto.plan);
  }

  @Get('subscription')
  status(@CurrentUser() user: JwtPayload) {
    return this.billing.getStatus(user.sub);
  }

  @Post('subscription/cancel')
  cancel(@CurrentUser() user: JwtPayload) {
    return this.billing.cancel(user.sub);
  }

  @Post('subscription/reactivate')
  reactivate(@CurrentUser() user: JwtPayload) {
    return this.billing.reactivate(user.sub);
  }

  @Get('payments')
  payments(@CurrentUser() user: JwtPayload) {
    return this.billing.listPayments(user.sub);
  }
}

@Controller('webhooks')
class WebhookController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: AppConfig,
  ) {}

  /** Public (no JWT) — the HMAC signature is the only defense. Responds <22s. */
  @Public()
  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  async mercadopago(
    @Body() body: { type?: string; data?: { id?: string } },
    @Query('data.id') queryDataId: string | undefined,
    @Query('type') queryType: string | undefined,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    const dataId = queryDataId ?? body?.data?.id ?? '';
    this.verifySignature(signature, requestId, dataId);
    await this.billing.handleWebhook(String(dataId), String(requestId ?? ''), String(body?.type ?? queryType ?? ''));
    return { ok: true };
  }

  private verifySignature(signature: string | undefined, requestId: string | undefined, dataId: string): void {
    const secret = this.config.mpWebhookSecret;
    if (!secret) return; // dev without a configured secret — skip (prod always sets it)
    const ts = signature?.match(/ts=([^,]+)/)?.[1];
    const v1 = signature?.match(/v1=([a-f0-9]+)/)?.[1];
    if (!ts || !v1) throw new UnauthorizedError('Firma ausente');
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const expected = createHmac('sha256', secret).update(manifest).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(v1);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedError('Firma inválida');
  }
}

@Module({
  controllers: [BillingController, WebhookController],
  providers: [
    BillingService,
    RequirePlanGuard,
    { provide: MercadoPagoPort, useClass: MercadoPagoHttpAdapter },
  ],
  exports: [BillingService, RequirePlanGuard],
})
export class BillingModule {}
