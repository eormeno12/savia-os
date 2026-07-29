import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './env.schema';

/**
 * Typed, validated config. Backed by the {@link Env} object that ConfigModule's
 * `validate` produced at boot, so every getter is guaranteed present + coerced.
 */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }
  get isProd(): boolean {
    return this.nodeEnv === 'production';
  }
  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get apiPort(): number {
    return this.get('API_PORT');
  }
  get mcpPort(): number {
    return this.get('MCP_PORT');
  }
  get host(): string {
    return this.get('HOST');
  }
  get logLevel(): string {
    return this.get('LOG_LEVEL');
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }
  get redisUrl(): string {
    return this.get('REDIS_URL');
  }
  get qdrantUrl(): string {
    return this.get('QDRANT_URL');
  }
  get qdrantCollection(): string {
    return this.get('QDRANT_COLLECTION');
  }

  get openaiApiKey(): string {
    return this.get('OPENAI_API_KEY');
  }
  get jwtSecret(): string {
    return this.get('JWT_SECRET');
  }
  get jwtRefreshSecret(): string {
    return this.get('JWT_REFRESH_SECRET');
  }
  get mcpTokenHmacKey(): string {
    return this.get('MCP_TOKEN_HMAC_KEY');
  }

  get awsRegion(): string | undefined {
    return this.get('AWS_REGION');
  }
  get s3Bucket(): string | undefined {
    return this.get('AWS_S3_BUCKET');
  }
  get sesFrom(): string | undefined {
    return this.get('AWS_SES_FROM');
  }

  get appOrigin(): string | undefined {
    return this.get('APP_ORIGIN');
  }
  get cookieDomain(): string | undefined {
    return this.get('COOKIE_DOMAIN');
  }
  get corsOrigins(): string[] {
    const raw = this.get('CORS_ORIGIN');
    return raw ? raw.split(',').map((o) => o.trim()).filter(Boolean) : [];
  }
  get otpDebug(): boolean {
    return this.get('OTP_DEBUG');
  }

  get mpAccessToken(): string | undefined {
    return this.get('MP_ACCESS_TOKEN');
  }
  get mpWebhookSecret(): string | undefined {
    return this.get('MP_WEBHOOK_SECRET');
  }
  get mpPlanMonthlyId(): string | undefined {
    return this.get('MP_PLAN_MONTHLY_ID');
  }
  get mpPlanAnnualId(): string | undefined {
    return this.get('MP_PLAN_ANNUAL_ID');
  }
  get mpBackUrl(): string | undefined {
    return this.get('MP_BACK_URL');
  }
}
