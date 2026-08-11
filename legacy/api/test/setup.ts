// Load the dev .env first (real DB/Redis/Qdrant creds for e2e), then fill any
// gaps with safe defaults. NODE_ENV is forced to 'test' regardless.
import { config as loadEnv } from 'dotenv';
loadEnv();

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://savia:savia@localhost:5433/savia';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.QDRANT_URL ??= 'http://localhost:6333';
process.env.OPENAI_API_KEY ??= 'test-openai-key';
process.env.JWT_SECRET ??= 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-jwt-refresh-secret';
process.env.MCP_TOKEN_HMAC_KEY ??= 'test-hmac-key';
