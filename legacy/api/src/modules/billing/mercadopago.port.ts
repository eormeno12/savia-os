export interface MpPreapproval {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  externalRef: string | null;
  initPoint?: string;
  nextPaymentAt?: string | null;
  amount?: number | null;
  currency?: string | null;
}

export interface MpAuthorizedPayment {
  id: string;
  status: string; // processed | recycling | scheduled | ...
  paymentStatus: string | null; // approved | rejected | ...
  externalRef: string | null;
  amount: number | null;
  currency: string | null;
  paidAt: string | null;
}

export interface MpPaymentRow {
  id: string;
  status: string;
  amount: number;
  currency: string;
  date: string;
  receiptUrl: string | null;
}

/** Hides the Mercado Pago HTTP surface (0A F8). The domain never sees MP URLs. */
export abstract class MercadoPagoPort {
  abstract createPreapproval(input: {
    planId: string;
    payerEmail: string;
    externalRef: string;
    backUrl: string;
  }): Promise<{ id: string; initPoint: string }>;
  abstract getPreapproval(id: string): Promise<MpPreapproval>;
  abstract updatePreapproval(id: string, body: Record<string, unknown>): Promise<MpPreapproval>;
  abstract getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment>;
  abstract listPayments(externalRef: string): Promise<MpPaymentRow[]>;
}
