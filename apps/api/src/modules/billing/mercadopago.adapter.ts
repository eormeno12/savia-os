import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../common/config/app.config';
import { UnavailableError } from '../../common/errors/domain-error';
import {
  MercadoPagoPort,
  MpAuthorizedPayment,
  MpPaymentRow,
  MpPreapproval,
} from './mercadopago.port';

const BASE = 'https://api.mercadopago.com';

@Injectable()
export class MercadoPagoHttpAdapter extends MercadoPagoPort {
  constructor(private readonly config: AppConfig) {
    super();
  }

  private async mp<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const token = this.config.mpAccessToken;
    if (!token) throw new UnavailableError('Pagos no configurados', 'BillingNotConfigured');
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw new UnavailableError(`Mercado Pago ${res.status}`, 'MercadoPagoError');
    return (await res.json()) as T;
  }

  async createPreapproval(input: {
    planId: string;
    payerEmail: string;
    externalRef: string;
    backUrl: string;
  }): Promise<{ id: string; initPoint: string }> {
    const r = await this.mp<{ id: string; init_point: string }>('/preapproval', 'POST', {
      preapproval_plan_id: input.planId,
      payer_email: input.payerEmail,
      external_reference: input.externalRef,
      back_url: input.backUrl,
      status: 'pending',
    });
    return { id: r.id, initPoint: r.init_point };
  }

  async getPreapproval(id: string): Promise<MpPreapproval> {
    return this.mapPreapproval(await this.mp(`/preapproval/${id}`));
  }

  async updatePreapproval(id: string, body: Record<string, unknown>): Promise<MpPreapproval> {
    return this.mapPreapproval(await this.mp(`/preapproval/${id}`, 'PUT', body));
  }

  async getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment> {
    const r = await this.mp<{
      id: string;
      status: string;
      external_reference?: string;
      payment?: { status?: string; id?: string };
      transaction_amount?: number;
      currency_id?: string;
      date_created?: string;
    }>(`/authorized_payments/${id}`);
    return {
      id: r.id,
      status: r.status,
      paymentStatus: r.payment?.status ?? null,
      externalRef: r.external_reference ?? null,
      amount: r.transaction_amount ?? null,
      currency: r.currency_id ?? null,
      paidAt: r.date_created ?? null,
    };
  }

  async listPayments(externalRef: string): Promise<MpPaymentRow[]> {
    const r = await this.mp<{ results?: Array<Record<string, unknown>> }>(
      `/v1/payments/search?external_reference=${encodeURIComponent(externalRef)}`,
    );
    return (r.results ?? []).map((p) => ({
      id: String(p.id),
      status: String(p.status),
      amount: Number(p.transaction_amount ?? 0),
      currency: String(p.currency_id ?? ''),
      date: String(p.date_created ?? ''),
      receiptUrl: (p.receipt_url as string | undefined) ?? null,
    }));
  }

  private mapPreapproval(r: {
    id: string;
    status: string;
    external_reference?: string;
    init_point?: string;
    next_payment_date?: string;
    auto_recurring?: { transaction_amount?: number; currency_id?: string };
  }): MpPreapproval {
    return {
      id: r.id,
      status: r.status,
      externalRef: r.external_reference ?? null,
      initPoint: r.init_point,
      nextPaymentAt: r.next_payment_date ?? null,
      amount: r.auto_recurring?.transaction_amount ?? null,
      currency: r.auto_recurring?.currency_id ?? null,
    };
  }
}
