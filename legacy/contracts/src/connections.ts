import { z } from 'zod';

export const CreateConnectionSchema = z.object({
  label: z.string().min(1).max(80),
});

export const GrantScopeSchema = z.enum(['space', 'group']);

/** A grant exposes exactly one target (an area subtree or a group). Lens never
 *  crosses an access boundary — it's 100% personal, never grant-able to an AI. */
export const CreateGrantSchema = z
  .object({
    scope: GrantScopeSchema,
    spaceId: z.string().optional(),
    groupId: z.string().optional(),
    includeSensitive: z.boolean().default(false),
  })
  .refine(
    (d) =>
      (d.scope === 'space' && !!d.spaceId && !d.groupId) ||
      (d.scope === 'group' && !!d.groupId && !d.spaceId),
    { message: 'Provide exactly one target matching the scope' },
  );

export const GrantDtoSchema = z.object({
  id: z.string(),
  scope: GrantScopeSchema,
  spaceId: z.string().nullable(),
  groupId: z.string().nullable(),
  includeSensitive: z.boolean(),
  createdAt: z.string(),
});

export const ConnectionDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  lastSeenAt: z.string().nullable(),
  revoked: z.boolean(),
  grants: z.array(GrantDtoSchema),
  createdAt: z.string(),
});

export const CreateConnectionResponseSchema = ConnectionDtoSchema.extend({
  token: z.string(),
});

export type CreateConnectionDto = z.infer<typeof CreateConnectionSchema>;
export type CreateGrantDto = z.infer<typeof CreateGrantSchema>;
export type GrantScope = z.infer<typeof GrantScopeSchema>;
export type GrantDto = z.infer<typeof GrantDtoSchema>;
export type ConnectionDto = z.infer<typeof ConnectionDtoSchema>;
export type CreateConnectionResponse = z.infer<typeof CreateConnectionResponseSchema>;
