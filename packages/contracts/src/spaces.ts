import { z } from 'zod';

export const CreateSpaceSchema = z.object({
  description: z.string().min(10),
});

export const UpdateSpaceSchema = z.object({
  description: z.string().min(10).optional(),
  name: z.string().min(1).max(50).optional(),
}).refine((d) => d.description !== undefined || d.name !== undefined, {
  message: 'Se requiere description o name',
});

export const SpaceDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.number(),
  memoryCount: z.number(),
  reclassifying: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SpaceMemoryDtoSchema = z.object({
  memoryId: z.string(),
  text: z.string(),
  score: z.number().optional(),
  manualOverride: z.boolean(),
  otherSpaces: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type CreateSpaceDto = z.infer<typeof CreateSpaceSchema>;
export type UpdateSpaceDto = z.infer<typeof UpdateSpaceSchema>;
export type SpaceDto = z.infer<typeof SpaceDtoSchema>;
export type SpaceMemoryDto = z.infer<typeof SpaceMemoryDtoSchema>;
