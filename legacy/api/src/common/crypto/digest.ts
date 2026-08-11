import { createHash } from 'node:crypto';

/**
 * One-way SHA-256 hex digest. Used for the AccessLog query digest (F1.7 / P0-3):
 * we record a fingerprint of the query, never the (PII-bearing) text, and it is
 * irreversible — unlike the old base64 encoding.
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
