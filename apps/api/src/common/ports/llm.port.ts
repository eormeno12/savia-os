/**
 * LlmPort — generative calls (area naming, sensitivity hints). Never on a hot
 * path; always batchable. One adapter behind it.
 */
export interface LlmCompleteOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
}

export abstract class LlmPort {
  abstract complete(prompt: string, opts?: LlmCompleteOptions): Promise<string>;
}
