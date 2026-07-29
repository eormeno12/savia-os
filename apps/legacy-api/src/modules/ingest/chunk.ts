const CHUNK_CHARS = 4000;
const OVERLAP_CHARS = 400;
const MAX_CHUNKS = 200;

/** Split text into overlapping chunks, preferring paragraph/line boundaries. */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];
  if (normalized.length <= CHUNK_CHARS) return [normalized];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length && chunks.length < MAX_CHUNKS) {
    const end = Math.min(start + CHUNK_CHARS, normalized.length);
    const slice = normalized.slice(start, end);
    let breakAt: number;
    if (end === normalized.length) {
      breakAt = end;
    } else {
      const lastPara = slice.lastIndexOf('\n\n');
      const lastNewline = slice.lastIndexOf('\n');
      breakAt =
        lastPara > CHUNK_CHARS / 2
          ? start + lastPara
          : lastNewline > CHUNK_CHARS / 2
            ? start + lastNewline
            : end;
    }
    const chunk = normalized.slice(start, breakAt).trim();
    if (chunk) chunks.push(chunk);
    start = Math.max(breakAt - OVERLAP_CHARS, breakAt === end ? end : start + 1);
    if (breakAt >= normalized.length) break;
  }
  return chunks;
}
