import { z } from "zod";

// Shared shapes for automation schedules and conditions (PRD §9).
// Used by the intent schema, the database jsonb columns and the scheduler.

export const usdcAmountString = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "Amount must be a positive decimal with at most 6 decimals")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero");

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm (24h)");

export const DAYS_OF_WEEK = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

export const scheduleSchema = z.discriminatedUnion("frequency", [
  z.object({
    frequency: z.literal("ONCE"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    time
  }),
  z.object({ frequency: z.literal("DAILY"), time }),
  z.object({ frequency: z.literal("WEEKLY"), dayOfWeek: z.enum(DAYS_OF_WEEK), time }),
  z.object({ frequency: z.literal("MONTHLY"), dayOfMonth: z.number().int().min(1).max(31), time })
]);

export const conditionSchema = z.object({
  // Wallet USDC balance must be >= amount before the transfer.
  type: z.literal("MIN_BALANCE"),
  amount: usdcAmountString
});

export type AutomationSchedule = z.infer<typeof scheduleSchema>;
export type AutomationCondition = z.infer<typeof conditionSchema>;
