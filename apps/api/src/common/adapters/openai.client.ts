import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AppConfig } from '../config/app.config';
import { CircuitBreaker } from '../resilience/circuit-breaker';

/**
 * The single `new OpenAI()` in the codebase. Adapters (embeddings, llm) depend on
 * this; the domain depends on the ports, never on this. (F0.1 / 02-SEC-7.)
 * Calls go through a circuit breaker so an OpenAI outage fails fast and clean.
 */
@Injectable()
export class OpenAiClient {
  readonly raw: OpenAI;
  private readonly breaker = new CircuitBreaker();

  constructor(config: AppConfig) {
    this.raw = new OpenAI({
      apiKey: config.openaiApiKey,
      timeout: 30_000,
      maxRetries: 2, // SDK backoff; the breaker stops hammering when it's truly down
    });
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return this.breaker.run(fn);
  }
}
