import { z } from 'zod';

export const SensitivitySchema = z.enum(['normal', 'sensitive']);

export const AddMemorySchema = z.object({
  text: z.string().min(1),
  // source NO se acepta del cliente: la procedencia la fija el servidor (acá siempre
  // 'manual'). Confiar en un source del cliente permitiría falsificar la traza (mcp/file).
  areaId: z.string().optional(), // optional target area; otherwise routed (General by default)
});

export const MemorySearchSchema = z.object({
  query: z.string().min(1),
  areaIds: z.array(z.string()).optional(), // clamp to these areas (∩ membership)
  limit: z.number().int().min(1).max(100).default(10),
});

export const MemoryResultSchema = z.object({
  id: z.string(),
  text: z.string(),
  score: z.number(),
  areaIds: z.array(z.string()),
  sensitivity: SensitivitySchema,
});

/** Edit membership (multi-area) and/or sensitivity — replaces "move home". */
export const UpdateMemorySchema = z
  .object({
    sensitivity: SensitivitySchema.optional(),
    addAreas: z.array(z.string()).optional(),
    removeAreas: z.array(z.string()).optional(),
  })
  .refine((d) => d.sensitivity !== undefined || d.addAreas?.length || d.removeAreas?.length, {
    message: 'Nada para actualizar',
  });

export type Sensitivity = z.infer<typeof SensitivitySchema>;
export type AddMemoryDto = z.infer<typeof AddMemorySchema>;
export type MemorySearchDto = z.infer<typeof MemorySearchSchema>;
export type MemoryResult = z.infer<typeof MemoryResultSchema>;
export type UpdateMemoryDto = z.infer<typeof UpdateMemorySchema>;
