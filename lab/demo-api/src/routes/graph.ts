import type { FastifyInstance } from 'fastify';
import { getMemoryGraph } from '../graph.js';

export async function graphRoute(app: FastifyInstance) {
  app.get<{ Querystring: { userId: string } }>('/graph', async (req, reply) => {
    const { userId } = req.query;
    if (!userId) return reply.status(400).send({ error: 'userId requerido' });
    return getMemoryGraph(userId);
  });
}
