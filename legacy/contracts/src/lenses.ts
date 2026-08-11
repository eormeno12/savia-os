import { z } from 'zod';

export const CreateLensSchema = z.object({
  name: z.string().min(1).max(80),
  query: z.string().min(1),
  radius: z.number().min(0.05).max(0.9).optional(), // cota coseno; default del servidor si se omite
  sourceAreaIds: z.array(z.string()).optional(), // subárboles fuente; vacío/omitido = todas las del dueño
});

export const LensDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  query: z.string().nullable(),
  radius: z.number(),
  sourceAreaIds: z.array(z.string()),
  createdAt: z.string(),
});

export type CreateLensDto = z.infer<typeof CreateLensSchema>;
export type LensDto = z.infer<typeof LensDtoSchema>;
