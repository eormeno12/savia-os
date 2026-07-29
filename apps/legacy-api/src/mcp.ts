import 'reflect-metadata';
import * as http from 'node:http';
import express, { NextFunction, Request, Response } from 'express';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { validateEnv } from './common/config/env.schema';
import { clientIp } from './common/http/client-ip';
import { LoggingModule } from './common/logging/logging.module';
import { InfraModule } from './common/infra/infra.module';
import { AppConfig } from './common/config/app.config';
import { PrismaService } from './common/clients/prisma.service';
import { RedisService } from './common/clients/redis.service';
import { ConnectionsModule } from './modules/connections/connections.module';
import { ConnectionsService } from './modules/connections/connections.service';
import { MemoryModule } from './modules/memory/memory.module';
import { MemoryService } from './modules/memory/memory.service';
import { CrossBoundaryReadService } from './modules/memory/cross-boundary-read.service';
import { AccessModule } from './modules/access/access.module';
import { AccessService } from './modules/access/access.service';
import { createMcpServerForRequest, McpServices } from './modules/mcp/mcp.tools';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggingModule,
    InfraModule,
    AccessModule,
    ConnectionsModule,
    MemoryModule,
  ],
})
class McpModule {}

const EDGE_RATE_WINDOW = 60;
const EDGE_RATE_MAX = 120; // per IP, pre-auth — guards Postgres from token-spam DoS

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(McpModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(AppConfig);
  const log = app.get(Logger);
  const redis = app.get(RedisService);

  const svc: McpServices = {
    connections: app.get(ConnectionsService),
    memory: app.get(MemoryService),
    reader: app.get(CrossBoundaryReadService),
    access: app.get(AccessService),
    prisma: app.get(PrismaService),
    redis,
  };

  const expressApp = express();
  expressApp.set('trust proxy', 1); // behind Caddy — same single hop as main.ts
  expressApp.use(express.json({ limit: '256kb' })); // bounded body

  // Edge rate-limit BEFORE token resolution (F1.6): cheap Redis counter by IP, so
  // garbage tokens never reach the argon2/Postgres path.
  const edgeLimit = async (req: Request, res: Response, next: NextFunction) => {
    const key = `mcp:rl:ip:${clientIp(req)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, EDGE_RATE_WINDOW);
    if (count > EDGE_RATE_MAX) return res.status(429).json({ error: 'Too many requests' });
    next();
  };

  expressApp.get('/health', (_req, res) => res.json({ status: 'ok', service: 'mcp' }));

  expressApp.post('/mcp', edgeLimit as express.RequestHandler, async (req, res) => {
    const auth = String(req.headers['authorization'] ?? '');
    const rawToken = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
    const server = createMcpServerForRequest(rawToken, svc);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => void transport.close().catch(() => null));
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      log.error(`MCP request error: ${(err as Error).message}`);
      if (!res.headersSent) res.status(500).json({ error: 'internal error' });
    }
  });

  const server = http.createServer(expressApp);
  server.listen(config.mcpPort, config.host, () =>
    log.log(`MCP server → http://${config.host}:${config.mcpPort}/mcp`),
  );
  // main.ts/worker.ts use enableShutdownHooks(); here we also own a raw
  // http.Server outside Nest's DI, so close both explicitly — for every
  // signal Nest would otherwise listen for (SIGTERM in prod, SIGINT for
  // local Ctrl+C), not just SIGTERM.
  const shutdown = () => {
    server.close();
    void app.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

void bootstrap();
