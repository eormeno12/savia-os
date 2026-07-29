import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('runs fn and resets the failure count on success', async () => {
    const breaker = new CircuitBreaker(2, 1_000);
    await expect(breaker.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
    expect(breaker.isOpen).toBe(false);
  });

  it('opens after `threshold` consecutive failures and fails fast without calling fn', async () => {
    const breaker = new CircuitBreaker(2, 1_000);
    const fn = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(breaker.run(fn)).rejects.toThrow('boom');
    expect(breaker.isOpen).toBe(false); // 1st failure — still under threshold
    await expect(breaker.run(fn)).rejects.toThrow('boom');
    expect(breaker.isOpen).toBe(true); // 2nd failure — trips the breaker

    fn.mockClear();
    await expect(breaker.run(fn)).rejects.toThrow('circuit open');
    expect(fn).not.toHaveBeenCalled();
  });

  it('closes again once the cooldown elapses', async () => {
    jest.useFakeTimers();
    const breaker = new CircuitBreaker(1, 1_000);
    await expect(breaker.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(breaker.isOpen).toBe(true);

    jest.advanceTimersByTime(1_001);
    expect(breaker.isOpen).toBe(false);
    await expect(breaker.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
    jest.useRealTimers();
  });
});
