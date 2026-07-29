import { applyMpEvent, BillingState, MpEvent } from './webhook-reducer';

const START: BillingState = { status: 'none', plan: 'free', consecutiveFailures: 0 };

function run(events: MpEvent[], from: BillingState = START): BillingState {
  return events.reduce((state, e) => applyMpEvent(state, e).state, from);
}

describe('applyMpEvent (webhook reducer)', () => {
  it('authorization grants pro', () => {
    const s = run([{ kind: 'preapproval', status: 'authorized' }]);
    expect(s).toEqual({ status: 'active', plan: 'pro', consecutiveFailures: 0 });
  });

  it('the canonical sequence: authorized→approved→recycling→recycling→rejected×3 ends free', () => {
    const s = run([
      { kind: 'preapproval', status: 'authorized' },
      { kind: 'payment', result: 'approved' },
      { kind: 'payment', result: 'recycling' },
      { kind: 'payment', result: 'recycling' },
      { kind: 'payment', result: 'rejected' },
      { kind: 'payment', result: 'rejected' },
      { kind: 'payment', result: 'rejected' },
    ]);
    expect(s.status).toBe('failed');
    expect(s.plan).toBe('free');
  });

  it('recycling never degrades access', () => {
    const active: BillingState = { status: 'active', plan: 'pro', consecutiveFailures: 0 };
    const s = run([{ kind: 'payment', result: 'recycling' }], active);
    expect(s.plan).toBe('pro');
    expect(s.status).toBe('active');
  });

  it('a single rejection keeps pro (within the retry window)', () => {
    const active: BillingState = { status: 'active', plan: 'pro', consecutiveFailures: 0 };
    const s = run([{ kind: 'payment', result: 'rejected' }], active);
    expect(s.plan).toBe('pro');
    expect(s.consecutiveFailures).toBe(1);
  });

  it('a successful payment resets the failure counter', () => {
    const failing: BillingState = { status: 'active', plan: 'pro', consecutiveFailures: 2 };
    const s = run([{ kind: 'payment', result: 'approved' }], failing);
    expect(s.consecutiveFailures).toBe(0);
  });

  it('cancellation keeps access during grace (status cancelled, still pro)', () => {
    const active: BillingState = { status: 'active', plan: 'pro', consecutiveFailures: 0 };
    const s = run([{ kind: 'preapproval', status: 'cancelled' }], active);
    expect(s.status).toBe('cancelled');
    expect(s.plan).toBe('pro');
  });

  it('records the payment outcome for the history', () => {
    expect(applyMpEvent(START, { kind: 'payment', result: 'approved' }).recordPayment).toBe('approved');
    expect(applyMpEvent(START, { kind: 'payment', result: 'rejected' }).recordPayment).toBe('rejected');
  });
});
