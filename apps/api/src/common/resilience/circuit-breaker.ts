/**
 * Minimal circuit breaker (F8.4). After `threshold` consecutive failures it opens
 * for `cooldownMs`, failing fast instead of hammering a downed dependency. Domain
 * adapters map the thrown error to UnavailableError → a clean 503 (D8), never 500.
 */
export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000,
  ) {}

  get isOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen) throw new Error('circuit open');
    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (err) {
      if (++this.failures >= this.threshold) this.openUntil = Date.now() + this.cooldownMs;
      throw err;
    }
  }
}
