import { BASE_DELAY_MS, MAX_ATTEMPTS, MAX_DELAY_MS, nextAttemptAt, nextAttemptDelayMs } from './backoff';

describe('outbox backoff schedule', () => {
  it('starts at BASE_DELAY_MS for the first retry', () => {
    expect(nextAttemptDelayMs(1)).toBe(BASE_DELAY_MS);
  });

  it('doubles each step', () => {
    expect(nextAttemptDelayMs(2)).toBe(BASE_DELAY_MS * 2);
    expect(nextAttemptDelayMs(3)).toBe(BASE_DELAY_MS * 4);
    expect(nextAttemptDelayMs(4)).toBe(BASE_DELAY_MS * 8);
  });

  it('caps at MAX_DELAY_MS for large attempt counts', () => {
    expect(nextAttemptDelayMs(20)).toBe(MAX_DELAY_MS);
    expect(nextAttemptDelayMs(1000)).toBe(MAX_DELAY_MS); // never overflows/Infinity
  });

  it('nextAttemptAt adds the delay to the given `now`, deterministically', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(nextAttemptAt(1, now).getTime()).toBe(now.getTime() + BASE_DELAY_MS);
  });

  it('spans hours, not seconds, by the time MAX_ATTEMPTS is reached (the actual bug being fixed)', () => {
    let totalMs = 0;
    for (let attempts = 1; attempts < MAX_ATTEMPTS; attempts++) totalMs += nextAttemptDelayMs(attempts);
    const totalHours = totalMs / 3_600_000;
    expect(totalHours).toBeGreaterThan(3);
    expect(totalHours).toBeLessThan(4);
  });
});
