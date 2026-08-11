import { z } from 'zod';

export const RescueTextSchema = z.object({
  text: z.string().min(10, 'El texto debe tener al menos 10 caracteres'),
});

export const ImportChatGptSchema = z.object({
  content: z.string().min(2, 'El archivo debe tener contenido'),
});

export const SuggestedSpaceSchema = z.object({
  name: z.string(),
  description: z.string(),
  memoryCount: z.number(),
  examples: z.array(z.string()),
});

export type RescueText = z.infer<typeof RescueTextSchema>;
export type ImportChatGpt = z.infer<typeof ImportChatGptSchema>;
export type SuggestedSpace = z.infer<typeof SuggestedSpaceSchema>;
