/**
 * Shared retry-backoff schedule for OutboxEvent processors (OutboxRelay,
 * VectorGarbageCollector). Exponential with a cap so a sustained outage
 * doesn't hot-loop, but recovers fast from a short blip.
 *
 * Schedule (delay before attempt N): 10s, 20s, 40s, 80s, 160s, 320s, 640s,
 * 1280s, 2560s→capped 3600s, 3600s, 3600s — attempt 12 (terminal 'failed')
 * lands at ~3.4h of cumulative elapsed time.
 */
export const BASE_DELAY_MS = 10_000; // 10s
export const MAX_DELAY_MS = 60 * 60_000; // 60min cap
export const MAX_ATTEMPTS = 12; // ~3.4h total time-to-failed

/** Milliseconds to wait before the next attempt, given attempts already made (>=1). */
export function nextAttemptDelayMs(attempts: number): number {
  const exp = BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(exp, MAX_DELAY_MS);
}

export function nextAttemptAt(attempts: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + nextAttemptDelayMs(attempts));
}
