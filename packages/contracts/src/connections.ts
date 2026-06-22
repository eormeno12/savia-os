import { z } from 'zod';

export const CreateConnectionSchema = z.object({
  label: z.string().min(1).max(80),
});

export const ConnectionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  lastSeenAt: z.string().nullable(),
  revoked: z.boolean(),
  spaceIds: z.array(z.string()),
  createdAt: z.string(),
});

export const CreateConnectionResponseSchema = ConnectionDtoSchema.extend({
  token: z.string(),
});

export const GrantSchema = z.object({
  spaceId: z.string(),
});

export type CreateConnectionDto = z.infer<typeof CreateConnectionSchema>;
export type ConnectionDto = z.infer<typeof ConnectionDtoSchema>;
export type CreateConnectionResponse = z.infer<typeof CreateConnectionResponseSchema>;
export type GrantDto = z.infer<typeof GrantSchema>;
