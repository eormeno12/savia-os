import 'reflect-metadata';
import * as http from 'http';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { PrismaService } from './common/clients/prisma.service';
import { QdrantService } from './common/clients/qdrant.service';
import { RedisService } from './common/clients/redis.service';
import { MemoryModule } from './modules/memory/memory.module';
import { MemoryService } from './modules/memory/memory.service';
import { ConnectionsModule } from './modules/connections/connections.module';
import { ConnectionsService } from './modules/connections/connections.service';
import { ClassifierService } from './modules/spaces/classifier.service';
import { createMcpServerForRequest } from './modules/mcp/mcp.tools';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MemoryModule,
    ConnectionsModule,
  ],
  providers: [PrismaService, QdrantService, RedisService, ClassifierService],
})
class McpAppModule {}

const MCP_PORT = 4401;

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(McpAppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const memory = app.get(MemoryService);
  const connections = app.get(ConnectionsService);
  const classifier = app.get(ClassifierService);
  const prisma = app.get(PrismaService);
  const redis = app.get(RedisService);

  const svc = { memory, connections, classifier, prisma, redis };

  const expressApp = express();
  expressApp.use(express.json());

  expressApp.post('/mcp', async (req, res) => {
    const authHeader = String(req.headers['authorization'] ?? '');
    const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const mcpServer = createMcpServerForRequest(rawToken, svc);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — no session cookies
    });

    res.on('close', () => transport.close().catch(() => null));

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err: any) {
      console.error('[MCP] request error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  expressApp.get('/health', (_req, res) =>
    res.json({ status: 'ok', service: 'mcp', port: MCP_PORT }),
  );

  const server = http.createServer(expressApp);
  server.listen(MCP_PORT, '127.0.0.1', () => {
    console.log(`[mcp] Savia MCP server → http://127.0.0.1:${MCP_PORT}/mcp`);
  });

  process.on('SIGTERM', async () => {
    server.close();
    await app.close();
    process.exit(0);
  });
}

bootstrap();
