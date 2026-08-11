import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import { AppConfig } from '../../common/config/app.config';
import { ConflictError, NotFoundError, UnavailableError } from '../../common/errors/domain-error';
import { MercadoPagoPort } from './mercadopago.port';
import { applyMpEvent, BillingState, MpEvent } from './webhook-reducer';
import type { BillingRow, PlanType, SubscriptionDto } from '@savia-os/legacy-contracts';

/** The plan↔Mercado Pago bridge: checkout, reconciled status, lifecycle, webhook. */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mp: MercadoPagoPort,
    private readonly config: AppConfig,
  ) {}

  async createSubscription(userId: string, email: string, plan: PlanType): Promise<{ initPoint: string }> {
    const planId = plan === 'annual' ? this.config.mpPlanAnnualId : this.config.mpPlanMonthlyId;
    if (!planId || !this.config.mpBackUrl) throw new UnavailableError('Pagos no configurados');
    const pre = await this.mp.createPreapproval({
      planId,
      payerEmail: email,
      externalRef: userId,
      backUrl: this.config.mpBackUrl,
    });
    await this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, mpPreapprovalId: pre.id, status: 'pending', planType: plan },
      update: { mpPreapprovalId: pre.id, status: 'pending', planType: plan },
    });
    return { initPoint: pre.initPoint };
  }

  /** Always reconciles with MP before answering (never trusts the DB alone). */
  async getStatus(userId: string): Promise<SubscriptionDto> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.mpPreapprovalId) return { status: 'none', planType: null, amount: null, currency: null, nextPaymentAt: null };
    try {
      const pre = await this.mp.getPreapproval(sub.mpPreapprovalId);
      const status = mapMpStatus(pre.status);
      if (status !== sub.status) {
        await this.prisma.subscription.update({ where: { userId }, data: { status } }).catch(() => null);
      }
      return {
        status,
        planType: sub.planType as PlanType | null,
        amount: pre.amount ?? toNum(sub.amount),
        currency: pre.currency ?? sub.currency,
        nextPaymentAt: pre.nextPaymentAt ?? sub.nextPaymentAt?.toISOString() ?? null,
      };
    } catch {
      return this.fromDb(sub);
    }
  }

  async cancel(userId: string): Promise<{ ok: true }> {
    const sub = await this.requireSub(userId);
    await this.mp.updatePreapproval(sub.mpPreapprovalId!, { status: 'cancelled' });
    await this.prisma.subscription.update({ where: { userId }, data: { status: 'cancelled', cancelledAt: new Date() } });
    return { ok: true };
  }

  async reactivate(userId: string): Promise<{ ok: true }> {
    const sub = await this.requireSub(userId);
    if (sub.nextPaymentAt && sub.nextPaymentAt < new Date()) throw new ConflictError('La gracia ya venció; suscribite de nuevo');
    await this.mp.updatePreapproval(sub.mpPreapprovalId!, { status: 'authorized' });
    await this.prisma.$transaction([
      this.prisma.subscription.update({ where: { userId }, data: { status: 'active', cancelledAt: null } }),
      this.prisma.user.update({ where: { id: userId }, data: { plan: 'pro' } }),
    ]);
    return { ok: true };
  }

  async listPayments(userId: string): Promise<BillingRow[]> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId }, include: { payments: true } });
    if (!sub) return [];
    return sub.payments
      .sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0))
      .map((p) => ({
        id: p.id,
        date: (p.paidAt ?? p.createdAt).toISOString(),
        period: (p.paidAt ?? p.createdAt).toLocaleDateString('es', { month: 'short', year: 'numeric' }),
        amount: toNum(p.amount) ?? 0,
        currency: p.currency,
        status: (p.status as BillingRow['status']) ?? 'pending',
        receiptUrl: null,
      }));
  }

  /**
   * Webhook (08 §6.3 pattern): idempotency (WebhookEvent PK) + reconcile with MP +
   * pure reducer + transactional apply of Subscription + User.plan + Payment.
   */
  async handleWebhook(dataId: string, requestId: string, type: string): Promise<void> {
    const eventId = `${dataId}:${requestId}`;
    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.webhookEvent.create({ data: { id: eventId, type } });
      } catch {
        this.logger.log(`webhook ${eventId} already processed — skipping`);
        return; // duplicate (MP is at-least-once)
      }

      if (type === 'subscription_preapproval') {
        const pre = await this.mp.getPreapproval(dataId);
        const userId = pre.externalRef;
        if (!userId) return;
        const sub = await tx.subscription.findUnique({ where: { userId } });
        const event: MpEvent = { kind: 'preapproval', status: mapPreEvent(pre.status) };
        await this.applyEvent(tx, userId, sub, event, { nextPaymentAt: pre.nextPaymentAt, amount: pre.amount, currency: pre.currency });
      } else if (type === 'subscription_authorized_payment') {
        const pay = await this.mp.getAuthorizedPayment(dataId);
        const userId = pay.externalRef;
        if (!userId) return;
        const sub = await tx.subscription.findUnique({ where: { userId } });
        const result: MpEvent = { kind: 'payment', result: mapPaymentResult(pay) };
        await this.applyEvent(tx, userId, sub, result, {}, pay);
      }
    });
  }

  private async applyEvent(
    tx: Prisma.TransactionClient,
    userId: string,
    sub: Subscription | null,
    event: MpEvent,
    patch: { nextPaymentAt?: string | null; amount?: number | null; currency?: string | null },
    payment?: { id: string; amount: number | null; currency: string | null; paymentStatus: string | null; paidAt: string | null },
  ): Promise<void> {
    const failures = await this.consecutiveFailures(tx, sub?.id);
    const prev: BillingState = {
      status: (sub?.status as BillingState['status']) ?? 'none',
      plan: failures >= 3 ? 'free' : 'pro',
      consecutiveFailures: failures,
    };
    const { state, recordPayment } = applyMpEvent(prev, event);

    const ensured = sub ?? (await tx.subscription.create({ data: { userId, status: 'pending' } }));
    await tx.subscription.update({
      where: { id: ensured.id },
      data: {
        status: state.status as SubscriptionStatus,
        ...(state.status === 'active' ? { startedAt: ensured.startedAt ?? new Date() } : {}),
        ...(patch.nextPaymentAt ? { nextPaymentAt: new Date(patch.nextPaymentAt) } : {}),
        ...(patch.amount != null ? { amount: patch.amount } : {}),
        ...(patch.currency ? { currency: patch.currency } : {}),
      },
    });
    await tx.user.update({ where: { id: userId }, data: { plan: state.plan } });

    if (recordPayment && payment) {
      await tx.payment
        .create({
          data: {
            subscriptionId: ensured.id,
            mpPaymentId: payment.id,
            status: payment.paymentStatus ?? recordPayment,
            amount: payment.amount ?? 0,
            currency: payment.currency ?? ensured.currency ?? 'USD',
            paidAt: payment.paidAt ? new Date(payment.paidAt) : null,
          },
        })
        .catch(() => null); // dedup by mpPaymentId unique
    }
  }

  private async consecutiveFailures(tx: Prisma.TransactionClient, subscriptionId?: string): Promise<number> {
    if (!subscriptionId) return 0;
    const payments = await tx.payment.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { status: true },
    });
    let n = 0;
    for (const p of payments) {
      if (p.status === 'approved') break;
      if (p.status === 'rejected') n++;
    }
    return n;
  }

  private async requireSub(userId: string): Promise<Subscription> {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.mpPreapprovalId) throw new NotFoundError('Sin suscripción');
    return sub;
  }

  private fromDb(sub: Subscription): SubscriptionDto {
    return {
      status: sub.status,
      planType: sub.planType as PlanType | null,
      amount: toNum(sub.amount),
      currency: sub.currency,
      nextPaymentAt: sub.nextPaymentAt?.toISOString() ?? null,
    };
  }
}

function toNum(d: Prisma.Decimal | null | undefined): number | null {
  return d == null ? null : Number(d);
}
function mapMpStatus(s: string): SubscriptionStatus {
  if (s === 'authorized') return 'active';
  if (s === 'paused') return 'paused';
  if (s === 'cancelled') return 'cancelled';
  if (s === 'pending') return 'pending';
  return 'none';
}
function mapPreEvent(s: string): 'authorized' | 'paused' | 'cancelled' | 'pending' {
  if (s === 'authorized') return 'authorized';
  if (s === 'paused') return 'paused';
  if (s === 'cancelled') return 'cancelled';
  return 'pending';
}
function mapPaymentResult(pay: { status: string; paymentStatus: string | null }): 'approved' | 'recycling' | 'rejected' {
  if (pay.status === 'recycling') return 'recycling';
  if (pay.status === 'processed' && pay.paymentStatus === 'approved') return 'approved';
  return 'rejected';
}
