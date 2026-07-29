import { Injectable, Logger } from '@nestjs/common';
import { LlmCompleteOptions, LlmPort } from '../ports/llm.port';
import { UnavailableError } from '../errors/domain-error';
import { OpenAiClient } from './openai.client';

const LLM_MODEL = 'gpt-5-nano';

@Injectable()
export class OpenAiLlmAdapter extends LlmPort {
  private readonly logger = new Logger(OpenAiLlmAdapter.name);

  constructor(private readonly openai: OpenAiClient) {
    super();
  }

  async complete(prompt: string, opts: LlmCompleteOptions = {}): Promise<string> {
    try {
      const res = await this.openai.run(() =>
        this.openai.raw.chat.completions.create({
        model: LLM_MODEL,
        // gpt-5-nano is a reasoning model: no `temperature` (ignored — opts.temperature
        // is a no-op here), and `max_tokens` is renamed `max_completion_tokens`.
        // `reasoning_effort` hardcoded 'minimal' — verified live: 'low' burned the ENTIRE
        // token budget on hidden reasoning (512 reasoning tokens to say 3 words, empty
        // visible output); 'minimal' is the only effort that reasons 0 tokens for this
        // trivial a task. Cast needed: this SDK version's ReasoningEffort type doesn't
        // include 'minimal' yet even though the live API accepts and requires it here.
        reasoning_effort: 'minimal' as 'low' | 'medium' | 'high',
        max_completion_tokens: opts.maxTokens ?? 256,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
          { role: 'user' as const, content: prompt },
        ],
        }),
      );
      return res.choices[0]?.message?.content ?? '';
    } catch (err) {
      this.logger.error(`llm failed: ${(err as Error).message}`);
      throw new UnavailableError('LLM provider unavailable', 'LlmUnavailable');
    }
  }
}
