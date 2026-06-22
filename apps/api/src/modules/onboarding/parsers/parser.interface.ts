export interface ParsedImport {
  /** Normalized text blocks ready to be passed to MemoryService.add */
  chunks: string[];
  /** Source identifier for audit (e.g. 'chatgpt', 'claude') */
  source: string;
}

export interface ChatParser {
  parse(raw: string): ParsedImport;
}
