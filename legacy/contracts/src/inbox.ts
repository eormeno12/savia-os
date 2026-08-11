import { z } from 'zod';

export const NotificationKindSchema = z.enum(['invite', 'suggestion', 'job', 'milestone', 'member_joined']);

export const InboxItemSchema = z.object({
  id: z.string(),
  kind: NotificationKindSchema,
  refId: z.string().nullable(),
  data: z.record(z.unknown()),
  seen: z.boolean(),
  createdAt: z.string(),
});

export const JobDtoSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(['queued', 'running', 'done', 'failed']),
  progress: z.number(),
  total: z.number().nullable(),
  resultRef: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const SuggestionDtoSchema = z.object({
  id: z.string(),
  kind: z.enum(['split', 'merge', 'duplicate']),
  status: z.enum(['pending', 'accepted', 'dismissed']),
  rationale: z.string(),
  payload: z.record(z.unknown()),
  createdAt: z.string(),
});

export type InboxItem = z.infer<typeof InboxItemSchema>;
export type JobDto = z.infer<typeof JobDtoSchema>;
export type SuggestionDto = z.infer<typeof SuggestionDtoSchema>;
