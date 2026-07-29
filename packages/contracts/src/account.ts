import { z } from 'zod';

export const AccountJobSchema = z.object({
  jobId: z.string(),
  status: z.string(),
});

export type AccountJob = z.infer<typeof AccountJobSchema>;
