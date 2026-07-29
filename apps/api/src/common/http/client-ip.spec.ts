import type { Request } from 'express';
import { clientIp } from './client-ip';

describe('clientIp', () => {
  it('returns req.ip (already trust-proxy-aware) as-is', () => {
    expect(clientIp({ ip: '203.0.113.7' } as Request)).toBe('203.0.113.7');
  });

  it('ignores a raw X-Forwarded-For header — req.ip is the only source of truth', () => {
    const req = {
      ip: '203.0.113.7', // what Express resolved per `trust proxy`
      headers: { 'x-forwarded-for': '1.2.3.4' }, // attacker-controlled, must be ignored
    } as unknown as Request;
    expect(clientIp(req)).toBe('203.0.113.7');
  });

  it('falls back to "unknown" when req.ip is unset', () => {
    expect(clientIp({} as Request)).toBe('unknown');
  });
});
