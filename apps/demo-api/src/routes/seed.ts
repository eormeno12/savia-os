import type { FastifyInstance } from 'fastify';
import { ensureSeeded } from '../seed.js';

interface SeedBody {
  userId: string;
  personaId: string;
}

export async function seedRoute(app: FastifyInstance) {
  app.post<{ Body: SeedBody }>('/seed', async (req, reply) => {
    const { userId, personaId } = req.body;
    if (!userId || !personaId) {
      return reply.status(400).send({ error: 'userId y personaId son requeridos' });
    }
    await ensureSeeded(userId, personaId);
    return reply.status(200).send({ ok: true });
  });
}
