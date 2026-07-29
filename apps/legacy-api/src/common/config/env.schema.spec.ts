import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  OPENAI_API_KEY: 'k',
  JWT_SECRET: 's',
  JWT_REFRESH_SECRET: 'r',
};

describe('validateEnv', () => {
  it('accepts a minimal dev env and applies defaults', () => {
    const env = validateEnv({ ...base });
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(4400);
    expect(env.QDRANT_COLLECTION).toBe('savia_memories');
  });

  it('throws when a required secret is missing', () => {
    expect(() => validateEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/OPENAI_API_KEY/);
  });

  it('requires AWS + MP + a real HMAC key in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/required in production/);
  });

  it('passes in production when all prod secrets are present', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      MCP_TOKEN_HMAC_KEY: 'real-secret',
      AWS_REGION: 'us-east-1',
      AWS_S3_BUCKET: 'b',
      AWS_SES_FROM: 'a@b.co',
      MP_ACCESS_TOKEN: 't',
      MP_WEBHOOK_SECRET: 'w',
      APP_ORIGIN: 'https://app.savia.uno',
    });
    expect(env.NODE_ENV).toBe('production');
    expect(env.MCP_TOKEN_HMAC_KEY).toBe('real-secret');
  });

  const prodBase = {
    ...base,
    NODE_ENV: 'production' as const,
    MCP_TOKEN_HMAC_KEY: 'real-secret',
    AWS_REGION: 'us-east-1',
    AWS_S3_BUCKET: 'b',
    AWS_SES_FROM: 'a@b.co',
    MP_ACCESS_TOKEN: 't',
    MP_WEBHOOK_SECRET: 'w',
  };
  const prodValid = { ...prodBase, APP_ORIGIN: 'https://app.savia.uno' };

  it('throws in production when neither APP_ORIGIN nor CORS_ORIGIN is set', () => {
    expect(() => validateEnv({ ...prodBase })).toThrow(/APP_ORIGIN or CORS_ORIGIN/);
  });

  it('passes in production with only CORS_ORIGIN set', () => {
    const env = validateEnv({ ...prodBase, CORS_ORIGIN: 'https://app.savia.uno' });
    expect(env.CORS_ORIGIN).toBe('https://app.savia.uno');
  });

  it('throws in production when OTP_DEBUG is enabled', () => {
    expect(() => validateEnv({ ...prodValid, OTP_DEBUG: 'true' })).toThrow(/OTP_DEBUG/);
  });

  it('passes in production when OTP_DEBUG is unset (defaults false)', () => {
    const env = validateEnv({ ...prodValid });
    expect(env.OTP_DEBUG).toBe(false);
  });

  it('parses the literal string "false" as false (regression: z.coerce.boolean() treats any non-empty string as true)', () => {
    const env = validateEnv({ ...base, OTP_DEBUG: 'false' });
    expect(env.OTP_DEBUG).toBe(false);
  });

  it('rejects a garbage OTP_DEBUG value instead of silently coercing it', () => {
    expect(() => validateEnv({ ...base, OTP_DEBUG: 'yes' })).toThrow();
  });
});
