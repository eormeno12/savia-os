import type { FastifyInstance } from "fastify";
import { chatPlain, chatWithMemory, chatPlainStream, chatWithMemoryStream, type StreamEvent } from "../openai-agent.js";
import { ensureSeeded } from "../seed.js";

interface ChatBody {
  message: string;
  userId: string;
  personaId?: string;
  sessionHistory: Array<{ role: "user" | "assistant"; content: string }>;
  mode?: 'both' | 'plain' | 'memory';
}

export async function chatRoute(app: FastifyInstance) {
  // Non-streaming (kept for compatibility)
  app.post<{ Body: ChatBody }>("/chat/json", async (req, reply) => {
    const { message, userId, personaId, sessionHistory } = req.body;

    if (!message || !userId) {
      return reply.status(400).send({ error: "message y userId son requeridos" });
    }

    if (personaId) {
      await ensureSeeded(userId, personaId);
    }

    const [plain, mem] = await Promise.all([
      chatPlain(sessionHistory ?? [], message),
      chatWithMemory(sessionHistory ?? [], message, userId),
    ]);

    return { plain, withMemory: mem.answer, toolCallsMade: mem.toolCallsMade };
  });

  // Streaming via SSE
  app.post<{ Body: ChatBody }>("/chat", async (req, reply) => {
    const { message, userId, personaId, sessionHistory, mode = 'both' } = req.body;

    if (!message || !userId) {
      return reply.status(400).send({ error: "message y userId son requeridos" });
    }

    if (personaId) {
      await ensureSeeded(userId, personaId);
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    });

    const send = (event: StreamEvent) => {
      if (!reply.raw.destroyed) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    if (mode === 'plain') {
      try {
        for await (const event of chatPlainStream(sessionHistory ?? [], message)) {
          send(event);
        }
      } catch {
        send({ type: "plain_delta", delta: "Error al generar respuesta." });
      }
      send({ type: "done", toolCallsMade: [] });
      reply.raw.end();
      return;
    }

    if (mode === 'memory') {
      const toolCallsMade: string[] = [];
      try {
        for await (const event of chatWithMemoryStream(sessionHistory ?? [], message, userId)) {
          if (event.type === "memory_done") {
            toolCallsMade.push(...event.toolCallsMade);
          } else {
            send(event);
          }
        }
      } catch {
        send({ type: "memory_delta", delta: "Error al generar respuesta." });
      }
      send({ type: "done", toolCallsMade });
      reply.raw.end();
      return;
    }

    // mode === 'both' (default)
    const toolCallsMade: string[] = [];
    let plainDone = false;
    let memoryDone = false;

    await new Promise<void>((resolve) => {
      const checkDone = () => {
        if (plainDone && memoryDone) {
          send({ type: "done", toolCallsMade });
          reply.raw.end();
          resolve();
        }
      };

      (async () => {
        try {
          for await (const event of chatPlainStream(sessionHistory ?? [], message)) {
            send(event);
          }
        } catch {
          send({ type: "plain_delta", delta: "Error al generar respuesta." });
          send({ type: "plain_done" });
        } finally {
          plainDone = true;
          checkDone();
        }
      })();

      (async () => {
        try {
          for await (const event of chatWithMemoryStream(sessionHistory ?? [], message, userId)) {
            if (event.type === "memory_done") {
              toolCallsMade.push(...event.toolCallsMade);
            } else {
              send(event);
            }
          }
        } catch {
          send({ type: "memory_delta", delta: "Error al generar respuesta." });
        } finally {
          memoryDone = true;
          checkDone();
        }
      })();
    });
  });
}
