interface GptMessage {
  author?: { role?: string };
  content?: { content_type?: string; parts?: (string | null)[] };
}
interface GptNode {
  message?: GptMessage;
}
interface GptConversation {
  title?: string;
  mapping?: Record<string, GptNode>;
}

function extractConversation(conv: GptConversation): string {
  if (!conv.mapping) return '';
  const lines = Object.values(conv.mapping)
    .filter((n) => n.message?.content?.content_type === 'text')
    .filter((n) => ['user', 'assistant'].includes(n.message?.author?.role ?? ''))
    .map((n) => {
      const role = n.message!.author!.role!;
      const text = (n.message!.content!.parts ?? []).filter(Boolean).join(' ').trim();
      return text ? `${role === 'user' ? 'Usuario' : 'IA'}: ${text}` : null;
    })
    .filter(Boolean);
  if (lines.length === 0) return '';
  return (conv.title ? `[${conv.title}]\n` : '') + lines.join('\n');
}

/** Parse a ChatGPT conversations.json export into ingestable text chunks. */
export function parseChatGptExport(raw: string): string[] {
  let data: GptConversation[];
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('El archivo no es un JSON válido');
  }
  if (!Array.isArray(data)) throw new Error('El archivo debe ser un array de conversaciones');
  return data
    .map(extractConversation)
    .filter((t) => t.length > 20)
    .map((t) => t.slice(0, 8000));
}
