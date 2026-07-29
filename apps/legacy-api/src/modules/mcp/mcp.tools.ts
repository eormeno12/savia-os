import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConnectionsService } from '../connections/connections.service';
import { MemoryService } from '../memory/memory.service';
import { CrossBoundaryReadService } from '../memory/cross-boundary-read.service';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../../common/clients/prisma.service';
import { RedisService } from '../../common/clients/redis.service';
import { sha256Hex } from '../../common/crypto/digest';

const RATE_WINDOW = 60;
const RATE_MAX = 30;

export interface McpServices {
  connections: ConnectionsService;
  memory: MemoryService;
  reader: CrossBoundaryReadService;
  access: AccessService;
  prisma: PrismaService;
  redis: RedisService;
}

async function rateLimit(redis: RedisService, connectionId: string): Promise<void> {
  const key = `mcp:rl:conn:${connectionId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RATE_WINDOW);
  if (count > RATE_MAX) throw new Error(`Rate limit excedido: máx ${RATE_MAX}/${RATE_WINDOW}s`);
}

/** Freemium enforcement at the gateway: a connection only works while its OWNER
 *  is on Pro (dropping to free cuts the AI's access instantly, without losing data). */
async function assertOwnerPro(prisma: PrismaService, userId: string): Promise<void> {
  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (owner?.plan !== 'pro') throw new Error('Requiere plan Pro — la suscripción del dueño no está activa');
}

const errorResult = (message: string) => ({
  content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
  isError: true,
});

/** Fresh stateless MCP server per request, with the bearer token bound in. */
export function createMcpServerForRequest(rawToken: string | undefined, svc: McpServices): McpServer {
  const logger = new Logger('McpTools');
  const server = new McpServer({ name: 'savia', version: '0.2.0' });

  // Zod + MCP SDK generic recursion trips TS2589; the cast is the documented escape.
  const addTool = (server as unknown as { tool: (...a: unknown[]) => void }).tool.bind(server) as (
    name: string,
    desc: string,
    schema: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<unknown>,
  ) => void;

  const resolve = async () => {
    if (!rawToken) throw new Error('No autorizado — falta el token Bearer');
    return svc.connections.resolveToken(rawToken);
  };

  addTool(
    'savia_search',
    'Busca en tu memoria de Savia. Devuelve recuerdos relevantes según los accesos concedidos a esta conexión.',
    {
      query: z.string().describe('Consulta en lenguaje natural'),
      areas: z.array(z.string()).optional().describe('IDs de áreas para acotar (se intersecta con tus accesos)'),
    },
    async (args) => {
      const { query, areas } = args as { query: string; areas?: string[] };
      try {
        const conn = await resolve();
        await rateLimit(svc.redis, conn.connectionId);
        await assertOwnerPro(svc.prisma, conn.userId);
        // Fan-out plan: reads the reader's own granted areas AND the live union of any
        // granted group (every member's shared fragments), each in its owner partition.
        const plan = await svc.access.buildConnectionReadPlan(conn.connectionId, areas);
        const results = await svc.reader.searchPartitions(plan, query, 10, conn.userId);
        // Audit is part of the operation: awaited, fail-loud (no silent catch). queryDigest, never the text.
        await svc.prisma.accessLog.create({
          data: {
            connectionId: conn.connectionId,
            action: 'search',
            spaceIds: areas ?? [],
            queryDigest: sha256Hex(query),
            resultCount: results.length,
          },
        });
        logger.log(`search conn=${conn.connectionId} results=${results.length}`);
        const output = results.map((r) => ({ id: r.memoryId, text: r.text, score: r.score, areas: r.areaIds }));
        return { content: [{ type: 'text' as const, text: JSON.stringify(output) }] };
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  addTool(
    'savia_remember',
    'Guarda un recuerdo en Savia. Se organiza automáticamente en tus áreas.',
    { content: z.string().describe('Texto a recordar') },
    async (args) => {
      const { content } = args as { content: string };
      try {
        const conn = await resolve();
        await rateLimit(svc.redis, conn.connectionId);
        await assertOwnerPro(svc.prisma, conn.userId);
        const ids = await svc.memory.add(conn.userId, content, {
          source: 'mcp',
          sourceRef: conn.connectionId, // qué IA la creó (sobrevive a la revocación)
          sourceLabel: conn.label, // "Claude Desktop" → Pulso
        });
        await svc.prisma.accessLog.create({
          data: { connectionId: conn.connectionId, action: 'remember', spaceIds: [], resultCount: ids.length },
        });
        logger.log(`remember conn=${conn.connectionId} → ${ids.length} memories`);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ stored: ids.length, ids }) }] };
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  );

  return server;
}
