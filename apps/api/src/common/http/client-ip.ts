import type { Request } from 'express';

/**
 * The client's real IP. Always use this instead of reading
 * `req.headers['x-forwarded-for']` by hand — Express's `req.ip` already
 * resolves it correctly per the app's `trust proxy` setting (set once in
 * main.ts/mcp.ts, both behind exactly one Caddy hop). A hand-rolled parse of
 * the raw header takes its left-most (client-controlled) entry instead,
 * defeating any IP-keyed rate limit.
 */
export function clientIp(req: Request): string {
  return req.ip ?? 'unknown';
}
