import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConnectionsService } from '../connections/connections.service';
import { MemoryService } from '../memory/memory.service';
import { ClassifierService } from '../spaces/classifier.service';
import { PrismaService } from '../../common/clients/prisma.service';
import { RedisService } from '../../common/clients/redis.service';

const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX = 30;

function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x));
}

async function checkRateLimit(redis: RedisService, connectionId: string): Promise<void> {
  const key = `mcp:ratelimit:${connectionId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW);
  if (count > RATE_LIMIT_MAX) {
    throw new Error(`Rate limit exceeded: max ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW}s`);
  }
}

interface Services {
  connections: ConnectionsService;
  memory: MemoryService;
  classifier: ClassifierService;
  prisma: PrismaService;
  redis: RedisService;
}

/** Create a fresh McpServer for each request with the bearer token baked in. */
export function createMcpServerForRequest(rawToken: string | undefined, svc: Services): McpServer {
  const logger = new Logger('McpTools');
  const server = new McpServer({ name: 'savia', version: '0.1.0' });

  async function resolveOrThrow() {
    if (!rawToken) throw new Error('No autorizado — falta el token Bearer');
    return svc.connections.resolveTokenCached(rawToken);
  }

  // Workaround: Zod + MCP SDK generic depth triggers TS2589; cast avoids it.
  const addTool = (server as any).tool.bind(server) as (
    name: string,
    desc: string,
    schema: Record<string, unknown>,
    handler: (args: any) => Promise<any>,
  ) => void;

  addTool(
    'savia_search',
    'Busca en la memoria de Savia. Devuelve recuerdos relevantes según los spaces concedidos.',
    {
      query: z.string().describe('Consulta de búsqueda en lenguaje natural'),
      spaces: z.array(z.string()).optional().describe(
        'IDs de spaces en que buscar (opcional). Savia intersecta con tus accesos.',
      ),
    },
    async ({ query, spaces }: { query: string; spaces?: string[] }) => {
      let resolved: Awaited<ReturnType<ConnectionsService['resolveTokenCached']>>;
      try {
        resolved = await resolveOrThrow();
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message }) }], isError: true };
      }

      try {
        await checkRateLimit(svc.redis, resolved.connectionId);
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message }) }], isError: true };
      }

      const requested = spaces ?? resolved.spaceIds;
      const effective = intersect(requested, resolved.spaceIds);

      const results = effective.length === 0
        ? []
        : await svc.memory.search(resolved.userId, query, { submemories: effective });

      await svc.prisma.accessLog.create({
        data: {
          connectionId: resolved.connectionId,
          action: 'search',
          spaceIds: effective,
          queryHash: Buffer.from(query).toString('base64').slice(0, 64),
          resultCount: results.length,
        },
      }).catch(() => null);

      logger.log(`search conn=${resolved.connectionId} spaces=[${effective}] results=${results.length}`);

      const output = results.map((r) => ({
        id: r.id,
        text: r.text,
        score: r.score,
        spaces: (r.metadata as any)?.submemories ?? [],
      }));

      return { content: [{ type: 'text' as const, text: JSON.stringify(output) }] };
    },
  );

  addTool(
    'savia_remember',
    'Guarda un recuerdo en Savia. Se clasifica automáticamente en tus spaces.',
    {
      content: z.string().describe('Texto a recordar'),
    },
    async ({ content }: { content: string }) => {
      let resolved: Awaited<ReturnType<ConnectionsService['resolveTokenCached']>>;
      try {
        resolved = await resolveOrThrow();
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message }) }], isError: true };
      }

      try {
        await checkRateLimit(svc.redis, resolved.connectionId);
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message }) }], isError: true };
      }

      const ids = await svc.memory.add(resolved.userId, content, {
        source: 'mcp',
        connectionId: resolved.connectionId,
      });

      // Classify in background
      if (ids.length > 0) {
        svc.classifier.embed(content).then((embedding) =>
          Promise.all(ids.map((id) =>
            svc.classifier.classifyOne(id, embedding, resolved.userId).catch(() => null),
          )),
        ).catch(() => null);
      }

      await svc.prisma.accessLog.create({
        data: {
          connectionId: resolved.connectionId,
          action: 'remember',
          spaceIds: [],
          resultCount: ids.length,
        },
      }).catch(() => null);

      logger.log(`remember conn=${resolved.connectionId} → ${ids.length} memories`);

      return { content: [{ type: 'text' as const, text: JSON.stringify({ stored: ids.length, ids }) }] };
    },
  );

  return server;
}
