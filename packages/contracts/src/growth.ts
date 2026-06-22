import { z } from 'zod';

export const AreaDtoSchema = z.object({
  spaceId: z.string(),
  name: z.string(),
  count: z.number(),
  share: z.number(),
});

export const GrowthPointSchema = z.object({
  bucket: z.string(),
  spaceId: z.string(),
  spaceName: z.string(),
  count: z.number(),
});

export const GrowthSummarySchema = z.object({
  points: z.array(GrowthPointSchema),
  todayTotal: z.number(),
  weekTotal: z.number(),
  weekDelta: z.number(),
});

export type AreaDto = z.infer<typeof AreaDtoSchema>;
export type GrowthPoint = z.infer<typeof GrowthPointSchema>;
export type GrowthSummary = z.infer<typeof GrowthSummarySchema>;
