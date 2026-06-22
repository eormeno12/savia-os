import { z } from 'zod';

export const AddMemorySchema = z.object({
  text: z.string().min(1),
  fileId: z.string().optional(),
  source: z.string().default('manual'),
});

export const MemorySearchQuerySchema = z.object({
  query: z.string().min(1),
  submemories: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).default(10),
});

export const MemoryResultSchema = z.object({
  id: z.string(),
  text: z.string(),
  score: z.number(),
  metadata: z.record(z.unknown()),
});

export type AddMemoryDto = z.infer<typeof AddMemorySchema>;
export type MemorySearchQuery = z.infer<typeof MemorySearchQuerySchema>;
export type MemoryResult = z.infer<typeof MemoryResultSchema>;
