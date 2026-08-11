import { PERSONAS } from './personas.js';
import { callMcpTool } from './mcp-client.js';

const MEM0_URL = process.env.MEM0_MCP_URL ?? 'http://localhost:8765';

const seededSessions = new Set<string>();

export function clearSeeded(userId: string): void {
  seededSessions.delete(userId);
}

export async function ensureSeeded(userId: string, personaId: string): Promise<void> {
  if (seededSessions.has(userId)) return;

  const persona = PERSONAS.find((p) => p.id === personaId);
  if (!persona) return;

  const [first, ...rest] = persona.memories;

  // First memory goes via MCP tool — this registers the user entity in OpenMemory's DB.
  // Without this the REST endpoint returns "User not found".
  if (first) {
    await callMcpTool(userId, 'add_memories', { text: first });
  }

  // Remaining memories go via REST with infer=false (verbatim, no LLM extraction).
  // The REST calls are truly parallel and each takes <50ms instead of ~3s per MCP call.
  if (rest.length > 0) {
    await Promise.all(
      rest.map((text) =>
        fetch(`${MEM0_URL}/api/v1/memories/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, text, infer: false }),
        }).catch(() => null)
      )
    );
  }

  seededSessions.add(userId);
}
