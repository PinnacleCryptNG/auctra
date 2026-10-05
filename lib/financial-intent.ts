import { z } from "zod";
import { conditionSchema, scheduleSchema, usdcAmountString } from "./automation-types";

// PRD §8. The LLM's output must parse with this schema before anything else
// happens. Destinations are a saved label or a literal address the user typed;
// a literal address is never executed directly (it starts the save-destination flow).

export const intentDestinationSchema = z.union([
  z.object({ label: z.string().trim().min(1).max(64) }).strict(),
  z.object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }).strict()
]);

export const financialIntentSchema = z
  .object({
    action: z.literal("TRANSFER"),
    asset: z.literal("USDC"),
    amount: usdcAmountString,
    destination: intentDestinationSchema,
    schedule: scheduleSchema,
    conditions: z.array(conditionSchema).max(1),
    memo: z.string().trim().min(1).max(140).optional()
  })
  .strict();

export type FinancialIntent = z.infer<typeof financialIntentSchema>;
export type IntentDestination = z.infer<typeof intentDestinationSchema>;
