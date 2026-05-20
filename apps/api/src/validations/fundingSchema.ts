import { z } from 'zod';

const positiveAmount = z
  .number()
  .finite('AMOUNT_MUST_BE_FINITE')
  .positive('AMOUNT_MUST_BE_POSITIVE');

export const mockFundingSchema = z.object({
  amount: positiveAmount,
  currency: z.string().trim().min(1).default('USD'),
  method: z.string().trim().max(100).optional(),
  accountLabel: z.string().trim().max(120).optional(),
  description: z.string().trim().max(240).optional(),
});
