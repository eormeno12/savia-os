import type { ConnectionOptions } from 'bullmq';

export const QUEUES = { ingest: 'ingest', import: 'import', accountDelete: 'account_delete' } as const;

/** BullMQ connection options derived from a redis:// URL. */
export function bullConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: url.password } : {}),
  };
}
