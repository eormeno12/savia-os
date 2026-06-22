import { z } from 'zod';

export const PresignRequestSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export const CreateFileSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  s3Key: z.string().min(1),
});

export const FileDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  status: z.enum(['pending', 'processing', 'indexed', 'failed']),
  source: z.string(),
  memoryCount: z.number().optional(),
  createdAt: z.string(),
  indexedAt: z.string().nullable(),
});

export type PresignRequest = z.infer<typeof PresignRequestSchema>;
export type CreateFileDto = z.infer<typeof CreateFileSchema>;
export type FileDto = z.infer<typeof FileDtoSchema>;
