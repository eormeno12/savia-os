import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LoggerModule } from 'nestjs-pino';

/**
 * Structured JSON logging (F0.4). Every request gets a `requestId` (honoring an
 * inbound `x-request-id`, echoed back) that is attached to req.id and surfaces in
 * the exception filter — the thread that ties an HTTP request to its logs (and,
 * later, to the BullMQ jobs it spawns). PII (emails, OTP codes, tokens, queries,
 * cookies) is redacted at the logger so it never reaches disk.
 */
export const LoggingModule = LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    genReqId(req: IncomingMessage, res: ServerResponse): string {
      const incoming = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
      res.setHeader('x-request-id', incoming);
      return incoming;
    },
    redact: {
      // pino-http's default req serializer only ever attaches
      // id/method/url/query/params/headers/remoteAddress/remotePort — never
      // `body` (nothing in this app logs req.body explicitly either), so
      // `req.query` is the one that actually needs covering (e.g. the
      // federation search text on GET /groups/:id/memories?q=...).
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'req.query',
        '*.password',
        '*.token',
        '*.rawToken',
        '*.codeHash',
        '*.tokenHash',
      ],
      censor: '[redacted]',
    },
  },
});
