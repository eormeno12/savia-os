import type { FastifyInstance } from 'fastify';
import { callMcpTool } from '../mcp-client.js';
import { clearSeeded } from '../seed.js';

interface CleanupBody {
  userIds: string[];
}

export async function cleanupRoute(app: FastifyInstance) {
  app.post<{ Body: CleanupBody }>('/cleanup', async (req, reply) => {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return reply.status(400).send({ error: 'userIds es requerido' });
    }
    await Promise.all(
      userIds.map((uid) => callMcpTool(uid, 'delete_all_memories', {}).catch(() => null))
    );
    userIds.forEach(clearSeeded);
    return reply.status(204).send();
  });
}
