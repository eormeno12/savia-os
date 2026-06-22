const CHUNK_CHARS = 4000;   // ~1k tokens at avg 4 chars/token
const OVERLAP_CHARS = 400;  // 10% overlap
const MAX_CHUNKS = 200;     // cost guard

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];

  // Short text fits in one chunk
  if (normalized.length <= CHUNK_CHARS) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length && chunks.length < MAX_CHUNKS) {
    const end = Math.min(start + CHUNK_CHARS, normalized.length);
    const slice = normalized.slice(start, end);

    let breakAt: number;
    if (end === normalized.length) {
      // Last chunk — take everything
      breakAt = end;
    } else {
      // Prefer breaking on paragraph > line > hard cut
      const lastPara = slice.lastIndexOf('\n\n');
      const lastNewline = slice.lastIndexOf('\n');
      breakAt = lastPara > CHUNK_CHARS / 2
        ? start + lastPara
        : lastNewline > CHUNK_CHARS / 2
          ? start + lastNewline
          : end;
    }

    const chunk = normalized.slice(start, breakAt).trim();
    if (chunk) chunks.push(chunk);

    // Advance with overlap, but always make forward progress
    start = Math.max(breakAt - OVERLAP_CHARS, breakAt === end ? end : start + 1);
    if (breakAt >= normalized.length) break;
  }

  if (chunks.length === MAX_CHUNKS && normalized.length > start) {
    console.warn(`[chunker] truncated at ${MAX_CHUNKS} chunks (${normalized.length} chars total)`);
  }

  return chunks;
}
