/**
 * The webhook reducer (0A F17) — a PURE state machine for Mercado Pago events.
 * No HTTP, no DB: the bug-prone sequencing logic (recycling must NOT degrade
 * access; only 3 consecutive failures drop to free) is a table-driven unit test.
 */
export type BillingStatus = 'none' | 'pending' | 'active' | 'paused' | 'cancelled' | 'failed';
export type Plan = 'free' | 'pro';

export interface BillingState {
  status: BillingStatus;
  plan: Plan;
  consecutiveFailures: number;
}

export type MpEvent =
  | { kind: 'preapproval'; status: 'authorized' | 'paused' | 'cancelled' | 'pending' }
  | { kind: 'payment'; result: 'approved' | 'recycling' | 'rejected' };

export interface ReduceResult {
  state: BillingState;
  recordPayment?: 'approved' | 'rejected';
}

const MAX_CONSECUTIVE_FAILURES = 3;

export function applyMpEvent(prev: BillingState, event: MpEvent): ReduceResult {
  if (event.kind === 'preapproval') {
    switch (event.status) {
      case 'authorized':
        return { state: { status: 'active', plan: 'pro', consecutiveFailures: 0 } };
      case 'paused':
        // retries — keep access (don't degrade)
        return { state: { ...prev, status: 'paused' } };
      case 'cancelled':
        // grace until nextPaymentAt; the downgrade to free happens at grace end
        return { state: { ...prev, status: 'cancelled' } };
      case 'pending':
        return { state: { ...prev, status: 'pending' } };
    }
  }

  switch (event.result) {
    case 'approved':
      return { state: { status: 'active', plan: 'pro', consecutiveFailures: 0 }, recordPayment: 'approved' };
    case 'recycling':
      // a retry in flight — neither a success nor (yet) a failure
      return { state: prev };
    case 'rejected': {
      const failures = prev.consecutiveFailures + 1;
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        return { state: { status: 'failed', plan: 'free', consecutiveFailures: failures }, recordPayment: 'rejected' };
      }
      // still within retry window → keep pro access
      return { state: { ...prev, consecutiveFailures: failures }, recordPayment: 'rejected' };
    }
  }
}
