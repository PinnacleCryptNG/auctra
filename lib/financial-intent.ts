import { z } from "zod";

export const financialIntentSchema = z.object({
  action: z.literal("TRANSFER"),
  asset: z.literal("USDC"),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  destination: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  schedule: z.object({
    frequency: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY"]),
    dayOfWeek: z.enum([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY"
    ]).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  }),
  conditions: z.array(
    z.object({
      type: z.literal("MIN_BALANCE"),
      amount: z.string().regex(/^\d+(\.\d+)?$/),
      asset: z.literal("USDC")
    })
  )
});

export type FinancialIntent = z.infer<typeof financialIntentSchema>;
