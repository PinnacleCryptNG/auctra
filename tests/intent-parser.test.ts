import { describe, expect, it, vi } from "vitest";
import { parseIntent, toFinancialIntent, type Extraction, type IntentModel } from "../lib/ai/intent-parser";

const base: Extraction = {
  outcome: "TRANSFER_REQUEST",
  unsupportedReason: null,
  amount: "20",
  asset: "USDC",
  destinationLabel: "savings wallet",
  destinationAddress: null,
  frequency: "WEEKLY",
  date: null,
  dayOfWeek: "FRIDAY",
  dayOfMonth: null,
  time: "18:00",
  minBalance: null,
  memo: null
};

describe("toFinancialIntent", () => {
  it("builds the PRD demo intent", () => {
    expect(toFinancialIntent(base)).toEqual({
      kind: "intent",
      intent: {
        action: "TRANSFER",
        asset: "USDC",
        amount: "20",
        destination: { label: "savings wallet" },
        schedule: { frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "18:00" },
        conditions: []
      }
    });
  });

  it("maps business requests with memo and minimum balance", () => {
    const result = toFinancialIntent({
      ...base,
      destinationLabel: "Acme Hosting",
      amount: "80",
      frequency: "MONTHLY",
      dayOfWeek: null,
      dayOfMonth: 1,
      time: "09:00",
      minBalance: "500",
      memo: "INV hosting"
    });
    expect(result).toMatchObject({
      kind: "intent",
      intent: {
        schedule: { frequency: "MONTHLY", dayOfMonth: 1, time: "09:00" },
        conditions: [{ type: "MIN_BALANCE", amount: "500" }],
        memo: "INV hosting"
      }
    });
  });

  it("asks instead of guessing when anything is missing", () => {
    expect(toFinancialIntent({ ...base, amount: null })).toMatchObject({ kind: "clarify" });
    expect(toFinancialIntent({ ...base, destinationLabel: null })).toMatchObject({ kind: "clarify" });
    expect(toFinancialIntent({ ...base, time: null })).toMatchObject({ kind: "clarify", question: expect.stringContaining("time") });
    expect(toFinancialIntent({ ...base, dayOfWeek: null })).toMatchObject({ kind: "clarify" });
    expect(toFinancialIntent({ ...base, frequency: "ONCE", date: null })).toMatchObject({ kind: "clarify" });
    expect(toFinancialIntent({ ...base, frequency: null })).toMatchObject({ kind: "clarify" });
    expect(toFinancialIntent({ ...base, destinationAddress: "0x2222222222222222222222222222222222222222" })).toMatchObject({ kind: "clarify" });
  });

  it("asks to rephrase when values fail the strict schema", () => {
    expect(toFinancialIntent({ ...base, amount: "-5" })).toMatchObject({ kind: "clarify" });
    expect(toFinancialIntent({ ...base, amount: "1.1234567" })).toMatchObject({ kind: "clarify" });
    expect(toFinancialIntent({ ...base, time: "6pm" })).toMatchObject({ kind: "clarify" });
    expect(toFinancialIntent({ ...base, frequency: "MONTHLY", dayOfWeek: null, dayOfMonth: 40 })).toMatchObject({ kind: "clarify" });
  });

  it("maps balance protection to a floor setting, never a transfer", () => {
    expect(toFinancialIntent({ ...base, outcome: "SET_BALANCE_FLOOR", amount: "300" })).toEqual({ kind: "set_floor", amount: "300" });
    expect(toFinancialIntent({ ...base, outcome: "SET_BALANCE_FLOOR", amount: null })).toMatchObject({ kind: "clarify" });
  });

  it("rejects other assets and unsupported actions", () => {
    expect(toFinancialIntent({ ...base, asset: "MON" })).toMatchObject({ kind: "unsupported" });
    expect(toFinancialIntent({ ...base, outcome: "UNSUPPORTED", unsupportedReason: "Auctra doesn't trade." })).toMatchObject({
      kind: "unsupported",
      message: expect.stringContaining("Auctra doesn't trade.")
    });
    expect(toFinancialIntent({ ...base, outcome: "NOT_A_REQUEST" })).toEqual({ kind: "not_a_request" });
  });
});

describe("parseIntent", () => {
  it("passes today's date in the user's timezone to the model", async () => {
    const model = vi.fn<IntentModel>(async () => base);
    await parseIntent(model, { message: "save 20", timezone: "Pacific/Auckland", now: new Date("2026-10-05T12:00:00Z") });
    expect(model).toHaveBeenCalledWith({ message: "save 20", today: "2026-10-06", timezone: "Pacific/Auckland" });
  });

  it("refuses addresses the user did not type", async () => {
    const hallucinated = "0x9999999999999999999999999999999999999999";
    const model: IntentModel = async () => ({ ...base, destinationLabel: null, destinationAddress: hallucinated });
    expect(await parseIntent(model, { message: "send 20 to my landlord every friday at 6pm", timezone: "UTC" })).toMatchObject({ kind: "clarify" });

    const typed = await parseIntent(model, { message: `send 20 to ${hallucinated} every friday at 6pm`, timezone: "UTC" });
    expect(typed).toMatchObject({ kind: "intent", intent: { destination: { address: hallucinated } } });
  });

  it("re-validates model output and handles refusals", async () => {
    const bad = (async () => ({ ...base, frequency: "HOURLY" })) as unknown as IntentModel;
    expect(await parseIntent(bad, { message: "x", timezone: "UTC" })).toMatchObject({ kind: "clarify" });
    expect(await parseIntent(async () => "refused", { message: "x", timezone: "UTC" })).toMatchObject({ kind: "unsupported" });
  });
});
