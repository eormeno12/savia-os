import { z } from 'zod';

export const SubscriptionStatusSchema = z.enum(['none', 'pending', 'active', 'paused', 'cancelled', 'failed']);
export const PlanTypeSchema = z.enum(['monthly', 'annual']);

export const StartSubscriptionSchema = z.object({
  plan: PlanTypeSchema.default('monthly'),
});

export const SubscriptionDtoSchema = z.object({
  status: SubscriptionStatusSchema,
  planType: PlanTypeSchema.nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  nextPaymentAt: z.string().nullable(),
});

export const BillingRowSchema = z.object({
  id: z.string(),
  date: z.string(),
  period: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['approved', 'rejected', 'refunded', 'pending']),
  receiptUrl: z.string().nullable(),
});

export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;
export type PlanType = z.infer<typeof PlanTypeSchema>;
export type StartSubscriptionDto = z.infer<typeof StartSubscriptionSchema>;
export type SubscriptionDto = z.infer<typeof SubscriptionDtoSchema>;
export type BillingRow = z.infer<typeof BillingRowSchema>;
