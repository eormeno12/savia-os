import { z } from 'zod';

// Pulso dashboard area-share row (distinct from the canonical AreaDto in areas.ts).
export const GrowthAreaDtoSchema = z.object({
  spaceId: z.string(),
  name: z.string(),
  count: z.number(),
  share: z.number(),
});

export const GrowthPointSchema = z.object({
  bucket: z.string(),
  count: z.number(),
});

export const GrowthSummarySchema = z.object({
  points: z.array(GrowthPointSchema),
  todayTotal: z.number(),
  weekTotal: z.number(),
  weekDelta: z.number(),
});

// Pulso event feed (event-sourced from MemoryEvent) + revert.
export const GrowthEventSchema = z.object({
  id: z.string(),
  action: z.enum(['create', 'move', 'split', 'merge', 'decay', 'sensitivity', 'supersede']),
  spaceId: z.string().nullable(),
  memoryId: z.string().nullable(),
  reverted: z.boolean(),
  revertable: z.boolean(),
  createdAt: z.string(),
});

export const GrowthEventsPageSchema = z.object({
  items: z.array(GrowthEventSchema),
  nextCursor: z.string().nullable(),
});

export type GrowthAreaDto = z.infer<typeof GrowthAreaDtoSchema>;
export type GrowthPoint = z.infer<typeof GrowthPointSchema>;
export type GrowthSummary = z.infer<typeof GrowthSummarySchema>;
export type GrowthEvent = z.infer<typeof GrowthEventSchema>;
export type GrowthEventsPage = z.infer<typeof GrowthEventsPageSchema>;
