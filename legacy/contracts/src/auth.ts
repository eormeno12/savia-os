import { z } from 'zod';

// Single source of email normalization: trim + lowercase BEFORE validating, so
// "Juan@X.com" and "juan@x.com" can never become two accounts.
const email = z.string().trim().toLowerCase().email();

export const RequestOtpSchema = z.object({
  email,
});

export const VerifyOtpSchema = z.object({
  email,
  code: z.string().length(6),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

export const MeSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  plan: z.enum(['free', 'pro']),
  createdAt: z.string(),
});

export type RequestOtpDto = z.infer<typeof RequestOtpSchema>;
export type VerifyOtpDto = z.infer<typeof VerifyOtpSchema>;
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
export type MeResponse = z.infer<typeof MeSchema>;
