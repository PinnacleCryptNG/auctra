import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { DAYS_OF_WEEK } from "../automation-types";
import { financialIntentSchema, type FinancialIntent } from "../financial-intent";

// PRD §8: Claude only extracts what the user said. It never authorizes, never
// resolves addresses, and never executes. Fields the user didn't state stay
// null, and deterministic code below turns gaps into clarifying questions.

export const DEFAULT_INTENT_MODEL = "claude-opus-5-5";

export const extractionSchema = z.object({
  outcome: z.enum(["TRANSFER_REQUEST", "UNSUPPORTED", "NOT_A_REQUEST"]),
  unsupportedReason: z.string().nullable(),
  amount: z.string().nullable(),
  asset: z.string().nullable(),
  destinationLabel: z.string().nullable(),
  destinationAddress: z.string().nullable(),
  frequency: z.enum(["ONCE", "DAILY", "WEEKLY", "MONTHLY"]).nullable(),
  date: z.string().nullable(),
  dayOfWeek: z.enum(DAYS_OF_WEEK).nullable(),
  dayOfMonth: z.number().int().nullable(),
  time: z.string().nullable(),
  minBalance: z.string().nullable(),
  memo: z.string().nullable()
});

export type Extraction = z.infer<typeof extractionSchema>;

export type ParseResult =
  | { kind: "intent"; intent: FinancialIntent }
  | { kind: "clarify"; question: string }
  | { kind: "unsupported"; message: string }
  | { kind: "not_a_request" };

export const SYSTEM_PROMPT = `You extract structured data from messages sent to Auctra, an assistant that schedules USDC transfers on Monad Testnet for individuals and businesses.

Auctra supports exactly one action: transferring a fixed USDC amount to one destination, once or on a schedule (daily, weekly on one weekday, or monthly on one day of the month), optionally only if the wallet balance is at least some amount before sending, optionally with a short memo such as an invoice reference.

Rules:
- Copy only what the user actually said. If something is not stated, set it to null. Never invent or assume an amount, destination, day, date or time.
- destinationLabel is the name the user used for the recipient (e.g. "savings wallet", "Acme Hosting"). destinationAddress is a 0x address only if the user typed one. Never produce an address that is not in the message.
- amount is a plain decimal string (e.g. "20" or "12.5"), without currency symbols.
- asset is the token the user named, uppercased (e.g. "USDC"), or null if none was named.
- time is 24-hour HH:mm. "6 PM" is "18:00", "noon" is "12:00". Null if no time was given.
- date is YYYY-MM-DD for one-time transfers. Resolve relative dates ("tomorrow", "next Tuesday") using the current date given in the message.
- dayOfWeek is for weekly schedules; dayOfMonth (1–31) is for monthly schedules ("on the 1st").
- minBalance is set only for conditions like "only if my balance is at least 300".
- Use UNSUPPORTED (with a one-sentence unsupportedReason) for anything outside the supported action: trading, swaps, other tokens, other chains, yield, lending, bill or card payments, payments split across several recipients, or financial advice.
- Use NOT_A_REQUEST for greetings, questions about Auctra, or messages that are not asking to move money.`;

export type IntentModel = (input: { message: string; today: string; timezone: string }) => Promise<Extraction | "refused">;

export function createClaudeIntentModel(options: { apiKey?: string; model?: string } = {}): IntentModel {
  const client = new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
  const model = options.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_INTENT_MODEL;

  return async ({ message, today, timezone }) => {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 2048,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(extractionSchema) },
      // Stable system prompt first for caching; per-request data goes in the user turn.
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Current date: ${today} (timezone ${timezone}).\n\nMessage:\n<message>\n${message}\n</message>`
        }
      ]
    });

    if (response.stop_reason === "refusal") return "refused";
    if (!response.parsed_output) throw new Error(`Intent extraction returned no parsed output (stop_reason=${response.stop_reason}).`);
    return response.parsed_output;
  };
}

const WEEKDAY_WORDS = DAYS_OF_WEEK.map((d) => d[0] + d.slice(1).toLowerCase());

/** Deterministic: extraction → FinancialIntent, or a clarifying question. Never guesses. */
export function toFinancialIntent(extraction: Extraction): ParseResult {
  if (extraction.outcome === "NOT_A_REQUEST") return { kind: "not_a_request" };
  if (extraction.outcome === "UNSUPPORTED") {
    return {
      kind: "unsupported",
      message: `${extraction.unsupportedReason ?? "That isn't something Auctra can do yet."} Auctra can schedule USDC transfers to your saved destinations on Monad Testnet.`
    };
  }

  if (extraction.asset && extraction.asset.toUpperCase() !== "USDC") {
    return { kind: "unsupported", message: `Auctra only moves USDC during the MVP, not ${extraction.asset}.` };
  }
  if (!extraction.amount) return { kind: "clarify", question: "How much USDC should I send?" };
  if (extraction.destinationLabel && extraction.destinationAddress) {
    return { kind: "clarify", question: "Should I send to the saved destination name or to the address you typed? Please give just one." };
  }
  if (!extraction.destinationLabel && !extraction.destinationAddress) {
    return { kind: "clarify", question: "Who should receive it? Name one of your saved destinations." };
  }
  if (!extraction.frequency) {
    return { kind: "clarify", question: "When should it run: once, every day, every week, or every month?" };
  }
  if (!extraction.time) return { kind: "clarify", question: "At what time should it run (for example 18:00)?" };

  let schedule: FinancialIntent["schedule"];
  switch (extraction.frequency) {
    case "ONCE":
      if (!extraction.date) return { kind: "clarify", question: "On which date should I send it?" };
      schedule = { frequency: "ONCE", date: extraction.date, time: extraction.time };
      break;
    case "DAILY":
      schedule = { frequency: "DAILY", time: extraction.time };
      break;
    case "WEEKLY":
      if (!extraction.dayOfWeek) return { kind: "clarify", question: `On which day of the week? (${WEEKDAY_WORDS.join(", ")})` };
      schedule = { frequency: "WEEKLY", dayOfWeek: extraction.dayOfWeek, time: extraction.time };
      break;
    case "MONTHLY":
      if (!extraction.dayOfMonth) return { kind: "clarify", question: "On which day of the month (1–31)?" };
      schedule = { frequency: "MONTHLY", dayOfMonth: extraction.dayOfMonth, time: extraction.time };
      break;
  }

  const candidate = {
    action: "TRANSFER",
    asset: "USDC",
    amount: extraction.amount,
    destination: extraction.destinationAddress
      ? { address: extraction.destinationAddress }
      : { label: extraction.destinationLabel! },
    schedule,
    conditions: extraction.minBalance ? [{ type: "MIN_BALANCE", amount: extraction.minBalance }] : [],
    ...(extraction.memo ? { memo: extraction.memo } : {})
  };

  const parsed = financialIntentSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { kind: "clarify", question: `I couldn't use that request (${issue.path.join(".") || "request"}: ${issue.message}). Could you rephrase it?` };
  }
  return { kind: "intent", intent: parsed.data };
}

export async function parseIntent(
  model: IntentModel,
  input: { message: string; timezone: string; now?: Date }
): Promise<ParseResult> {
  const today = (input.now ?? new Date()).toLocaleDateString("en-CA", { timeZone: input.timezone });
  const extraction = await model({ message: input.message.slice(0, 2000), today, timezone: input.timezone });
  if (extraction === "refused") {
    return { kind: "unsupported", message: "I can't help with that request." };
  }
  // Validate again on our side: the model output is untrusted input.
  const checked = extractionSchema.safeParse(extraction);
  if (!checked.success) return { kind: "clarify", question: "I didn't understand that. Could you rephrase your request?" };

  // An address must come from the user, never from the model.
  const address = checked.data.destinationAddress;
  if (address && !input.message.toLowerCase().includes(address.toLowerCase())) {
    return { kind: "clarify", question: "Who should receive it? Name one of your saved destinations." };
  }
  return toFinancialIntent(checked.data);
}
