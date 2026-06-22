import { z } from 'zod';

export const RequestOtpSchema = z.object({
  email: z.string().email(),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const MeSchema = z.object({
  id: z.string(),
  email: z.string(),
  createdAt: z.string(),
});

export type RequestOtpDto = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
export type MeResponse = z.infer<typeof MeSchema>;
