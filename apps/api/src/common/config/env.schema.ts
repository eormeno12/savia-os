import { z } from 'zod';

/**
 * Boot-time env validation (F0.2). Runs in all three entrypoints (main/worker/mcp)
 * via ConfigModule's `validate`. In production the secrets are REQUIRED — the
 * process refuses to boot without them. In dev they fall back to safe locals so
 * the stack runs offline.
 *
 * We validate with zod (already the project's validation stack via nestjs-zod)
 * instead of Joi — same guarantee, one fewer dependency.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4400),
    MCP_PORT: z.coerce.number().int().positive().default(4401),
    HOST: z.string().default('127.0.0.1'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    QDRANT_URL: z.string().default('http://localhost:6333'),
    QDRANT_COLLECTION: z.string().default('savia_memories'),

    OPENAI_API_KEY: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    JWT_REFRESH_SECRET: z.string().min(1),
    // Deterministic token lookup for MCP connections (HMAC). Dev gets a stable
    // insecure default; production MUST override (enforced below).
    MCP_TOKEN_HMAC_KEY: z.string().min(1).default('dev-insecure-mcp-hmac-key'),

    AWS_REGION: z.string().optional(),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_SES_FROM: z.string().optional(),

    APP_ORIGIN: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    COOKIE_DOMAIN: z.string().optional(),
    // z.coerce.boolean() would be wrong here: it does `Boolean(str)`, so the
    // literal string "false" (any non-empty env value) coerces to `true`.
    // Parse the two valid textual values explicitly instead.
    OTP_DEBUG: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    // Mercado Pago (FASE-7). Optional in dev, required in prod.
    MP_ACCESS_TOKEN: z.string().optional(),
    MP_WEBHOOK_SECRET: z.string().optional(),
    MP_PLAN_MONTHLY_ID: z.string().optional(),
    MP_PLAN_ANNUAL_ID: z.string().optional(),
    MP_BACK_URL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    const requiredInProd: (keyof typeof env)[] = [
      'AWS_REGION',
      'AWS_S3_BUCKET',
      'AWS_SES_FROM',
      'MP_ACCESS_TOKEN',
      'MP_WEBHOOK_SECRET',
    ];
    for (const key of requiredInProd) {
      if (!env[key]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required in production` });
      }
    }
    if (env.MCP_TOKEN_HMAC_KEY === 'dev-insecure-mcp-hmac-key') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MCP_TOKEN_HMAC_KEY'],
        message: 'MCP_TOKEN_HMAC_KEY must be set to a real secret in production',
      });
    }
    // Both feed the same CORS allowlist (main.ts) — without at least one, prod
    // would silently fall back to the hardcoded localhost dev origins only.
    if (!env.APP_ORIGIN && !env.CORS_ORIGIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'APP_ORIGIN or CORS_ORIGIN is required in production',
      });
    }
    if (env.OTP_DEBUG) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OTP_DEBUG'],
        message: 'OTP_DEBUG must not be enabled in production (logs real OTP codes)',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** ConfigModule `validate` hook — throws (process won't boot) on invalid env. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
