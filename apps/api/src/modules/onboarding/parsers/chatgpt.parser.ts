import type { ChatParser, ParsedImport } from './parser.interface';

interface GptMessage {
  author?: { role?: string };
  content?: { content_type?: string; parts?: (string | null)[] };
}

interface GptNode {
  message?: GptMessage;
  children?: string[];
}

interface GptConversation {
  title?: string;
  mapping?: Record<string, GptNode>;
}

function extractTextFromConversation(conv: GptConversation): string {
  if (!conv.mapping) return '';

  const nodes = Object.values(conv.mapping)
    .filter((n) => n.message?.author?.role && n.message?.content?.content_type === 'text')
    .filter((n) => {
      const role = n.message!.author!.role!;
      return role === 'user' || role === 'assistant';
    });

  const lines = nodes
    .map((n) => {
      const role = n.message!.author!.role!;
      const parts = n.message!.content!.parts ?? [];
      const text = parts.filter(Boolean).join(' ').trim();
      if (!text) return null;
      return `${role === 'user' ? 'Usuario' : 'IA'}: ${text}`;
    })
    .filter(Boolean);

  if (lines.length === 0) return '';
  const header = conv.title ? `[${conv.title}]\n` : '';
  return header + lines.join('\n');
}

export const chatGptParser: ChatParser = {
  parse(raw: string): ParsedImport {
    let data: GptConversation[];
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('El archivo no es un JSON válido');
    }

    if (!Array.isArray(data)) {
      throw new Error('El archivo debe ser un array de conversaciones');
    }

    const chunks = data
      .map(extractTextFromConversation)
      .filter((t) => t.length > 20)
      // Trim very long conversations to 8 000 chars so mem0 doesn't choke
      .map((t) => t.slice(0, 8_000));

    return { chunks, source: 'chatgpt' };
  },
};
