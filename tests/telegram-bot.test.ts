import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/client";
import { automations, users } from "../db/schema";
import type { Extraction, IntentModel } from "../lib/ai/intent-parser";
import type { InlineKeyboard, TelegramClient, TelegramUpdate } from "../lib/telegram/api";
import { handleUpdate, type BotDeps } from "../lib/telegram/bot";
import { createTestDb } from "./helpers/db";
import { VENDOR_ADDRESS, createFixture } from "./helpers/fixtures";

const NOW = new Date("2026-10-05T10:00:00Z");
const demo: Extraction = {
  outcome: "TRANSFER_REQUEST",
  unsupportedReason: null,
  amount: "20",
  asset: "USDC",
  destinationLabel: "my savings wallet",
  destinationAddress: null,
  frequency: "WEEKLY",
  date: null,
  dayOfWeek: "FRIDAY",
  dayOfMonth: null,
  time: "18:00",
  minBalance: null,
  memo: null
};

type Sent = { chatId: string; text: string; keyboard?: InlineKeyboard };

let db: Db;
let sent: Sent[];
let updateId = 0;

function makeDeps(model: IntentModel = async () => demo): BotDeps & { telegram: TelegramClient } {
  const telegram: TelegramClient = {
    sendMessage: vi.fn(async (chatId: string, text: string, keyboard?: InlineKeyboard) => {
      sent.push({ chatId, text, keyboard });
    }),
    answerCallbackQuery: vi.fn(async () => undefined),
    clearKeyboard: vi.fn(async () => undefined)
  };
  return {
    db,
    telegram,
    intentModel: model,
    appUrl: "https://auctra.example",
    readBalances: async () => ({ mon: BigInt(10) ** BigInt(18), usdc: BigInt(125_500_000) }),
    execution: {
      signer: { sendTransaction: vi.fn(async () => ({ hash: `0x${"a".repeat(64)}` as `0x${string}` })) },
      readUsdcBalance: async () => BigInt(500_000_000),
      waitForReceipt: async () => "success",
      isProviderRejection: () => false,
      notify: async () => undefined
    },
    onDestinationsChanged: vi.fn(async () => undefined),
    now: () => NOW
  };
}

const text = (telegramId: string, body: string): TelegramUpdate => ({
  update_id: ++updateId,
  message: { message_id: updateId, chat: { id: Number(telegramId.replace(/\D/g, "")), type: "private" }, from: { id: Number(telegramId.replace(/\D/g, "")) }, text: body }
});
const tap = (telegramId: string, data: string): TelegramUpdate => ({
  update_id: ++updateId,
  callback_query: { id: `cb${updateId}`, from: { id: Number(telegramId.replace(/\D/g, "")) }, data, message: { message_id: updateId, chat: { id: 1, type: "private" } } }
});
const lastButton = () => sent.at(-1)!.keyboard!.inline_keyboard[0][0] as { callback_data?: string; web_app?: { url: string } };

beforeEach(async () => {
  db = await createTestDb();
  sent = [];
});

describe("telegram bot", () => {
  it("sends a single-use onboarding Mini App link on /start", async () => {
    await handleUpdate(makeDeps(), text("777", "/start"));
    expect(sent[0].text).toContain("never asks for a seed phrase");
    expect(lastButton().web_app?.url).toMatch(/^https:\/\/auctra\.example\/onboarding\?token=/);
  });

  it("processes a retried update only once", async () => {
    const deps = makeDeps();
    const update = text("778", "/start");
    await handleUpdate(deps, update);
    await handleUpdate(deps, update);
    expect(sent).toHaveLength(1);
  });

  it("runs the demo: natural language → exact summary → confirm → active", async () => {
    const { ctx } = await createFixture(db);
    const deps = makeDeps();
    await handleUpdate(deps, text(ctx.user.telegramId!, "Save 20 USDC to my savings wallet every Friday at 6 PM"));

    expect(sent[0].text).toContain("Send: 20 USDC");
    expect(sent[0].text).toContain("every Friday at 18:00 (Africa/Lagos)");
    expect(sent[0].text).toContain("Monad Testnet");
    const confirm = lastButton().callback_data!;
    expect(confirm).toMatch(/^ca:/);

    await handleUpdate(deps, tap(ctx.user.telegramId!, confirm));
    expect(sent.at(-1)!.text).toContain("Automation active");
    const [automation] = await db.select().from(automations);
    expect(automation.status).toBe("ACTIVE");
  });

  it("does not let another user confirm someone else's automation", async () => {
    const { ctx } = await createFixture(db);
    const other = await createFixture(db);
    const deps = makeDeps();
    await handleUpdate(deps, text(ctx.user.telegramId!, "Save 20 USDC to my savings wallet every Friday at 6 PM"));
    const confirm = lastButton().callback_data!;

    await handleUpdate(deps, tap(other.ctx.user.telegramId!, confirm));
    expect(sent.at(-1)!.text).toContain("expired or was already used");
    expect(await db.select().from(automations)).toHaveLength(0);
  });

  it("asks a clarifying question and combines the answer with the original request", async () => {
    const { ctx } = await createFixture(db);
    const model = vi.fn<IntentModel>(async ({ message }) => (message.includes("6 PM") ? demo : { ...demo, time: null }));
    const deps = makeDeps(model);

    await handleUpdate(deps, text(ctx.user.telegramId!, "Save 20 USDC to my savings wallet every Friday"));
    expect(sent.at(-1)!.text).toContain("what time");
    await handleUpdate(deps, text(ctx.user.telegramId!, "6 PM"));
    expect(model.mock.calls[1][0].message).toBe("Save 20 USDC to my savings wallet every Friday\n6 PM");
    expect(sent.at(-1)!.text).toContain("Please confirm this automation");
    const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
    expect(user.pendingRequest).toBeNull();
  });

  it("saves a business vendor destination after confirmation and syncs the policy", async () => {
    const { ctx } = await createFixture(db, { type: "BUSINESS" });
    const deps = makeDeps();
    await handleUpdate(deps, text(ctx.user.telegramId!, `/destinations add ${VENDOR_ADDRESS} Acme Hosting as vendor`));
    expect(sent.at(-1)!.text).toContain("Name: Acme Hosting");
    expect(sent.at(-1)!.text).toContain("Category: vendor");

    await handleUpdate(deps, tap(ctx.user.telegramId!, lastButton().callback_data!));
    expect(sent.at(-1)!.text).toContain("Saved Acme Hosting (vendor)");
    expect(deps.onDestinationsChanged).toHaveBeenCalledWith(ctx.account!.id);
  });

  it("explains unsupported requests and shows balances", async () => {
    const { ctx } = await createFixture(db);
    const deps = makeDeps(async () => ({ ...demo, outcome: "UNSUPPORTED", unsupportedReason: "Auctra doesn't trade tokens." }));
    await handleUpdate(deps, text(ctx.user.telegramId!, "buy MON when it dips"));
    expect(sent.at(-1)!.text).toContain("Auctra doesn't trade tokens.");

    await handleUpdate(deps, text(ctx.user.telegramId!, "/balance"));
    expect(sent.at(-1)!.text).toContain("USDC: 125.5");
  });

  it("pauses and runs an automation from buttons", async () => {
    const { ctx } = await createFixture(db);
    const deps = makeDeps();
    await handleUpdate(deps, text(ctx.user.telegramId!, "Save 20 USDC to my savings wallet every Friday at 6 PM"));
    await handleUpdate(deps, tap(ctx.user.telegramId!, lastButton().callback_data!));

    await handleUpdate(deps, text(ctx.user.telegramId!, "/run"));
    await handleUpdate(deps, tap(ctx.user.telegramId!, lastButton().callback_data!));
    expect(deps.execution.signer.sendTransaction).toHaveBeenCalledTimes(1);

    await handleUpdate(deps, text(ctx.user.telegramId!, "/pause"));
    await handleUpdate(deps, tap(ctx.user.telegramId!, lastButton().callback_data!));
    expect(sent.at(-1)!.text).toBe("Automation paused.");
  });

  it("asks unfinished users to complete onboarding", async () => {
    const deps = makeDeps();
    await handleUpdate(deps, text("779", "Save 20 USDC every Friday"));
    expect(lastButton().web_app?.url).toContain("/onboarding?token=");
  });
});
