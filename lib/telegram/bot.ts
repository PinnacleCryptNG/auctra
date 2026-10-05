import { and, eq } from "drizzle-orm";
import type { Address } from "viem";
import type { Db } from "../../db/client";
import { telegramUpdates, users } from "../../db/schema";
import { parseIntent, type IntentModel } from "../ai/intent-parser";
import { formatDateTime, formatUsdc } from "../format";
import { formatUsdcAmount } from "../usdc";
import { usdcAmountString } from "../automation-types";
import { accountDisplayName, createLinkToken, getAccountContext, getOrCreateTelegramUser, updateSettings, type AccountContext } from "../services/accounts";
import { activateAutomation, changeAutomationStatus, describeAutomation, listAutomations, prepareAutomation, type StatusAction } from "../services/automations";
import { confirmDestination, describeDestination, DESTINATION_CATEGORIES, listDestinations, proposeDestination, type DestinationCategory } from "../services/destinations";
import { UserFacingError } from "../services/errors";
import { listExecutions, runNow, type ExecutionDeps } from "../services/executions";
import type { InlineKeyboard, TelegramClient, TelegramUpdate } from "./api";

// PRD §11. Telegram is the primary surface: natural language first, commands
// as shortcuts, buttons only for confirmations and high-value actions.

export type BotDeps = {
  db: Db;
  telegram: TelegramClient;
  intentModel: IntentModel;
  appUrl: string;
  readBalances: (address: Address) => Promise<{ mon: bigint; usdc: bigint }>;
  execution: ExecutionDeps;
  /** Called after a destination is saved, to update the Privy policy allowlist. */
  onDestinationsChanged: (accountId: string) => Promise<void>;
  now?: () => Date;
};

const PENDING_TTL_MS = 10 * 60 * 1000;

const HELP = [
  "Tell me what you want your money to do, for example:",
  "• Save 20 USDC to my savings wallet every Friday at 6 PM",
  "• Pay Acme Hosting 80 USDC on the 1st of every month at 09:00, memo INV hosting",
  "• Send 50 USDC to my reserve every Monday at 10:00 only if my balance is at least 500",
  "• Never let my wallet fall below 300 USDC",
  "",
  "Commands:",
  "/balance: testnet balances",
  "/automations: your automations",
  "/destinations: saved destinations (add with /destinations add <0xaddress> <name> [as vendor])",
  "/pause, /resume, /cancel, /run: manage an automation",
  "/history: recent executions",
  "/help: this message",
  "",
  "Auctra runs on Monad Testnet with test USDC only."
].join("\n");

function onboardingKeyboard(appUrl: string, token: string): InlineKeyboard {
  const url = `${appUrl}/onboarding?token=${encodeURIComponent(token)}`;
  // Telegram Mini Apps require HTTPS; fall back to a plain link in local development.
  const button = url.startsWith("https://") ? { text: "Set up Auctra", web_app: { url } } : { text: "Set up Auctra", url };
  return { inline_keyboard: [[button]] };
}

function isReady(ctx: AccountContext | null): ctx is AccountContext & { account: NonNullable<AccountContext["account"]>; wallet: NonNullable<AccountContext["wallet"]> } {
  return Boolean(ctx?.account && ctx.wallet);
}

export async function handleUpdate(deps: BotDeps, update: TelegramUpdate): Promise<void> {
  const { db } = deps;

  // Telegram retries undelivered updates; process each update_id once (PRD §11).
  const [fresh] = await db.insert(telegramUpdates).values({ updateId: update.update_id }).onConflictDoNothing().returning();
  if (!fresh) return;

  if (update.callback_query) return handleCallback(deps, update.callback_query);

  const message = update.message;
  if (!message?.text || !message.from || message.chat.type !== "private") return;
  const chatId = String(message.chat.id);

  try {
    const user = await getOrCreateTelegramUser(db, { telegramId: String(message.from.id), chatId });
    await handleText(deps, chatId, user.id, message.text.trim());
  } catch (error) {
    await deps.telegram.sendMessage(chatId, error instanceof UserFacingError ? error.message : "Something went wrong. Please try again.");
    if (!(error instanceof UserFacingError)) console.error("Telegram handler error", error);
  }
}

async function handleText(deps: BotDeps, chatId: string, userId: string, text: string) {
  const { db, telegram } = deps;
  const ctx = await getAccountContext(db, { userId });
  const [command, ...args] = text.split(/\s+/);
  const name = command.startsWith("/") ? command.slice(1).split("@")[0].toLowerCase() : null;

  if (name === "start" || (!isReady(ctx) && name !== "help")) {
    if (isReady(ctx)) {
      await telegram.sendMessage(chatId, `Welcome back. ${accountDisplayName(ctx.account)}, wallet ${ctx.wallet.address}.\n\n${HELP}`);
      return;
    }
    const token = await createLinkToken(db, userId);
    await telegram.sendMessage(
      chatId,
      [
        "Welcome to Auctra. Tell Auctra what you want your money to do, and it handles the rest.",
        "",
        "First, set up your account (personal or business) and your Monad Testnet wallet. Auctra never asks for a seed phrase or private key.",
        "This link works once and expires in 30 minutes."
      ].join("\n"),
      onboardingKeyboard(deps.appUrl, token)
    );
    return;
  }
  if (!isReady(ctx)) {
    await telegram.sendMessage(chatId, HELP);
    return;
  }

  switch (name) {
    case "help":
    case "new":
      await telegram.sendMessage(chatId, HELP);
      return;
    case "balance":
      return sendBalance(deps, chatId, ctx);
    case "automations":
      return sendAutomations(deps, chatId, ctx);
    case "destinations":
      return args[0]?.toLowerCase() === "add" ? addDestination(deps, chatId, ctx, args.slice(1)) : sendDestinations(deps, chatId, ctx);
    case "history":
      return sendHistory(deps, chatId, ctx);
    case "pause":
    case "resume":
    case "cancel":
    case "run":
      return sendActionPicker(deps, chatId, ctx, name);
    case null:
      return handleRequest(deps, chatId, ctx, text);
    default:
      await telegram.sendMessage(chatId, `Unknown command /${name}.\n\n${HELP}`);
  }
}

async function sendBalance(deps: BotDeps, chatId: string, ctx: AccountContext & { wallet: NonNullable<AccountContext["wallet"]> }) {
  const { mon, usdc } = await deps.readBalances(ctx.wallet.address as Address);
  const monText = (Number(mon) / 1e18).toFixed(4);
  await deps.telegram.sendMessage(
    chatId,
    [`Wallet ${ctx.wallet.address} (Monad Testnet)`, `USDC: ${formatUsdcAmount(usdc)}`, `MON (gas): ${monText}`].join("\n")
  );
}

async function sendAutomations(deps: BotDeps, chatId: string, ctx: AccountContext & { account: NonNullable<AccountContext["account"]> }) {
  const rows = await listAutomations(deps.db, ctx.account.id, ["ACTIVE", "PAUSED"]);
  if (rows.length === 0) {
    await deps.telegram.sendMessage(chatId, "You have no automations yet. Describe one in a message, e.g. \"Save 20 USDC to my savings wallet every Friday at 6 PM\".");
    return;
  }
  const lines = rows.map(({ automation, destination }, index) => {
    const next = automation.status === "ACTIVE" && automation.nextRunAt ? `next ${formatDateTime(automation.nextRunAt, automation.timezone)}` : automation.status.toLowerCase();
    return `${index + 1}. ${describeAutomation(automation, destination)} (${next})`;
  });
  await deps.telegram.sendMessage(chatId, lines.join("\n"));
}

async function sendDestinations(deps: BotDeps, chatId: string, ctx: AccountContext & { account: NonNullable<AccountContext["account"]> }) {
  const rows = await listDestinations(deps.db, ctx.account.id);
  const list = rows.length ? rows.map((d) => `• ${describeDestination(d)}`).join("\n") : "No saved destinations yet.";
  await deps.telegram.sendMessage(
    chatId,
    `${list}\n\nTo add one: /destinations add <0xaddress> <name> [as ${DESTINATION_CATEGORIES.map((c) => c.toLowerCase()).join("|")}]`
  );
}

async function addDestination(deps: BotDeps, chatId: string, ctx: AccountContext & { account: NonNullable<AccountContext["account"]>; wallet: NonNullable<AccountContext["wallet"]> }, args: string[]) {
  const [address, ...rest] = args;
  let category: DestinationCategory = "OTHER";
  const asIndex = rest.length >= 2 ? rest.length - 2 : -1;
  if (asIndex >= 0 && rest[asIndex].toLowerCase() === "as" && DESTINATION_CATEGORIES.includes(rest[asIndex + 1].toUpperCase() as DestinationCategory)) {
    category = rest[asIndex + 1].toUpperCase() as DestinationCategory;
    rest.splice(asIndex, 2);
  }
  const label = rest.join(" ");
  if (!address || !label) {
    await deps.telegram.sendMessage(chatId, "Usage: /destinations add <0xaddress> <name> [as vendor]");
    return;
  }

  const { confirmationId, proposal } = await proposeDestination(deps.db, {
    userId: ctx.user.id,
    accountId: ctx.account.id,
    walletAddress: ctx.wallet.address,
    label,
    address,
    category
  });
  await deps.telegram.sendMessage(
    chatId,
    ["Save this destination?", `• Name: ${proposal.label}`, `• Category: ${proposal.category.toLowerCase()}`, `• Address: ${proposal.address}`, "", "Check every character of the address. Transfers to it can't be reversed."].join("\n"),
    { inline_keyboard: [[{ text: "Save destination", callback_data: `cd:${confirmationId}` }, { text: "Cancel", callback_data: "xx:" }]] }
  );
}

async function sendHistory(deps: BotDeps, chatId: string, ctx: AccountContext & { account: NonNullable<AccountContext["account"]> }) {
  const rows = await listExecutions(deps.db, ctx.account.id, 10);
  if (rows.length === 0) {
    await deps.telegram.sendMessage(chatId, "No executions yet.");
    return;
  }
  const lines = rows.map(({ execution, destination }) => {
    const when = formatDateTime(execution.createdAt, ctx.user.timezone);
    return `${when}: ${execution.status} ${formatUsdc(execution.amount)} USDC → ${destination.label}${execution.txHash ? ` (${execution.txHash.slice(0, 10)}…)` : execution.errorCode ? ` (${execution.errorCode})` : ""}`;
  });
  await deps.telegram.sendMessage(chatId, lines.join("\n"));
}

const PICKER: Record<string, { statuses: ("ACTIVE" | "PAUSED")[]; prefix: string; verb: string }> = {
  pause: { statuses: ["ACTIVE"], prefix: "ap", verb: "Pause" },
  resume: { statuses: ["PAUSED"], prefix: "ar", verb: "Resume" },
  cancel: { statuses: ["ACTIVE", "PAUSED"], prefix: "ac", verb: "Cancel" },
  run: { statuses: ["ACTIVE"], prefix: "rn", verb: "Run now" }
};

async function sendActionPicker(deps: BotDeps, chatId: string, ctx: AccountContext & { account: NonNullable<AccountContext["account"]> }, action: string) {
  const picker = PICKER[action];
  const rows = await listAutomations(deps.db, ctx.account.id, picker.statuses);
  if (rows.length === 0) {
    await deps.telegram.sendMessage(chatId, `No automations to ${action}.`);
    return;
  }
  await deps.telegram.sendMessage(chatId, `Which automation should I ${picker.verb.toLowerCase()}?`, {
    inline_keyboard: rows.slice(0, 10).map(({ automation, destination }) => [
      { text: `${picker.verb}: ${formatUsdc(automation.amount)} USDC → ${destination.label}`.slice(0, 64), callback_data: `${picker.prefix}:${automation.id}` }
    ])
  });
}

async function handleRequest(deps: BotDeps, chatId: string, ctx: AccountContext & { account: NonNullable<AccountContext["account"]>; wallet: NonNullable<AccountContext["wallet"]> }, text: string) {
  const { db, telegram } = deps;
  const now = deps.now?.() ?? new Date();

  const pending = ctx.user.pendingRequest && ctx.user.pendingRequestExpiresAt && ctx.user.pendingRequestExpiresAt > now ? ctx.user.pendingRequest : null;
  const message = pending ? `${pending}\n${text}` : text;
  const result = await parseIntent(deps.intentModel, { message, timezone: ctx.user.timezone, now });

  const setPending = (value: string | null) =>
    db
      .update(users)
      .set({ pendingRequest: value, pendingRequestExpiresAt: value ? new Date(now.getTime() + PENDING_TTL_MS) : null })
      .where(eq(users.id, ctx.user.id));

  switch (result.kind) {
    case "clarify":
      await setPending(message.slice(-1500));
      await telegram.sendMessage(chatId, result.question);
      return;
    case "unsupported":
      await setPending(null);
      await telegram.sendMessage(chatId, result.message);
      return;
    case "set_floor":
      await setPending(null);
      await telegram.sendMessage(
        chatId,
        `Set a balance floor of ${formatUsdc(result.amount)} USDC?\nAuctra will skip any transfer that would leave your wallet with less than this. It never moves money in to top it up.`,
        { inline_keyboard: [[{ text: "Set floor", callback_data: `bf:${result.amount}` }, { text: "Cancel", callback_data: "xx:" }]] }
      );
      return;
    case "not_a_request":
      await setPending(null);
      await telegram.sendMessage(chatId, HELP);
      return;
    case "intent": {
      await setPending(null);
      const prepared = await prepareAutomation(db, ctx, result.intent, now);
      if (prepared.kind === "needs_destination") {
        await telegram.sendMessage(chatId, `${prepared.address} isn't a saved destination. Save it first, then ask again:\n/destinations add ${prepared.address} <name>`);
        return;
      }
      const warning = ctx.wallet.signerStatus !== "GRANTED" ? "\n\nNote: Auctra can't send yet. Grant permission in the dashboard under Settings." : "";
      await telegram.sendMessage(chatId, prepared.summary + warning, {
        inline_keyboard: [[{ text: "Confirm", callback_data: `ca:${prepared.confirmationId}` }, { text: "Cancel", callback_data: "xx:" }]]
      });
    }
  }
}

async function handleCallback(deps: BotDeps, callback: NonNullable<TelegramUpdate["callback_query"]>) {
  const { db, telegram } = deps;
  const chatId = callback.message ? String(callback.message.chat.id) : null;
  const [prefix, id] = (callback.data ?? "").split(":");

  const reply = async (text: string) => {
    await telegram.answerCallbackQuery(callback.id).catch(() => undefined);
    if (chatId) await telegram.sendMessage(chatId, text);
  };

  try {
    if (callback.message && chatId && ["ca", "cd", "bf", "xx"].includes(prefix)) {
      // One tap per confirmation message.
      await telegram.clearKeyboard(chatId, callback.message.message_id).catch(() => undefined);
    }
    if (prefix === "xx") return reply("Cancelled. Nothing was changed.");

    const [user] = await db.select().from(users).where(and(eq(users.telegramId, String(callback.from.id))));
    const ctx = user ? await getAccountContext(db, { userId: user.id }) : null;
    if (!isReady(ctx)) return reply("Finish setting up Auctra first: send /start.");

    switch (prefix) {
      case "ca": {
        const automation = await activateAutomation(db, ctx, id, deps.now?.());
        return reply(`Automation active. First run: ${formatDateTime(automation.nextRunAt!, automation.timezone)}.`);
      }
      case "cd": {
        const destination = await confirmDestination(db, { confirmationId: id, userId: ctx.user.id, accountId: ctx.account.id });
        await deps.onDestinationsChanged(ctx.account.id);
        return reply(`Saved ${describeDestination(destination)}.`);
      }
      case "bf": {
        if (!usdcAmountString.safeParse(id).success) return reply("That button has expired.");
        await updateSettings(db, { userId: ctx.user.id, accountId: ctx.account.id, balanceFloor: id });
        return reply(`Balance floor set to ${formatUsdc(id)} USDC.`);
      }
      case "ap":
      case "ar":
      case "ac": {
        const action: StatusAction = prefix === "ap" ? "pause" : prefix === "ar" ? "resume" : "cancel";
        const updated = await changeAutomationStatus(db, { userId: ctx.user.id, accountId: ctx.account.id, automationId: id, action }, deps.now?.());
        return reply(`Automation ${updated.status.toLowerCase()}.`);
      }
      case "rn": {
        // Same message + automation = same request id, so a double tap can't send twice.
        const requestId = `tg-${callback.message?.message_id ?? callback.id}-${id.slice(0, 8)}`;
        await telegram.answerCallbackQuery(callback.id, "Running…").catch(() => undefined);
        const execution = await runNow(db, deps.execution, { accountId: ctx.account.id, automationId: id, requestId, userId: ctx.user.id }, deps.now?.());
        if (chatId && execution.status === "SUBMITTED") await telegram.sendMessage(chatId, "Submitted. I'll confirm when the transaction settles.");
        if (chatId && execution.status === "PENDING") await telegram.sendMessage(chatId, "Submitted, but the result isn't known yet. I'll report back.");
        return;
      }
      default:
        return reply("That button has expired.");
    }
  } catch (error) {
    if (!(error instanceof UserFacingError)) console.error("Telegram callback error", error);
    await reply(error instanceof UserFacingError ? error.message : "Something went wrong. Please try again.");
  }
}

