import { Injectable, Logger } from '@nestjs/common';
import { MemoryService } from '../memory/memory.service';
import { ClusterService } from './cluster.service';
import { chatGptParser } from './parsers/chatgpt.parser';

const RESCUE_PROMPT = `Por favor, haz un resumen detallado de todo lo que sabes sobre mí a lo largo de nuestras conversaciones. Incluye:

- Trabajo y carrera: rol, empresa, proyectos actuales, habilidades
- Salud y bienestar: condiciones, hábitos, preferencias
- Relaciones: familia, amigos, socios importantes
- Educación e intereses: áreas de estudio, hobbies, lo que me apasiona
- Objetivos y planes: corto, mediano y largo plazo
- Preferencias y personalidad: cómo tomo decisiones, qué valoro
- Cualquier otro dato relevante que recuerdes

Organízalo en hechos concretos, uno por línea. Por ejemplo:
- Trabaja como ingeniero de software en una startup de IA
- Tiene 32 años y vive en Buenos Aires
- Está aprendiendo TypeScript y le interesa la arquitectura de sistemas

Responde solo con los hechos, sin introducción ni conclusión.`;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly memory: MemoryService,
    private readonly cluster: ClusterService,
  ) {}

  getRescuePrompt(): string {
    return RESCUE_PROMPT;
  }

  async ingestRescue(userId: string, text: string): Promise<{ count: number }> {
    this.logger.log(`ingestRescue userId=${userId} len=${text.length}`);
    const ids = await this.memory.add(userId, text, { source: 'chat_import' });
    return { count: ids.length };
  }

  async importChatGpt(userId: string, rawJson: string): Promise<{ queued: number }> {
    const { chunks, source } = chatGptParser.parse(rawJson);
    this.logger.log(`importChatGpt userId=${userId} conversations=${chunks.length}`);

    // Ingest in background — don't block the response
    Promise.all(
      chunks.map((chunk) =>
        this.memory.add(userId, chunk, { source }).catch((err) => {
          this.logger.warn(`importChatGpt chunk failed: ${err.message}`);
          return [];
        }),
      ),
    ).catch(() => null);

    return { queued: chunks.length };
  }

  async suggestSpaces(userId: string) {
    return this.cluster.suggestSpaces(userId);
  }
}
