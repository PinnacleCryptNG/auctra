// Auctra sandbox engine: the real services, bot, scheduler and validation on
// PGlite in the browser. Only the edges are simulated: wallet/chain, clock,
// Privy and Telegram's transport. The dashboard talks to it through the same
// /api/* contract as production (see handleApi).

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { decodeFunctionData, erc20Abi, getAddress, type Address, type Hex } from "viem";
import initSql from "../../drizzle/0000_init.sql";
import pendingSql from "../../drizzle/0001_pending_request.sql";
import policyFingerprintSql from "../../drizzle/0002_policy_fingerprint.sql";
import type { Db } from "../../db/client";
import * as schema from "../../db/schema";
import { parseIntent, SYSTEM_PROMPT, type Extraction, type IntentModel } from "../../lib/ai/intent-parser";
import { AuctraConfig } from "../../lib/config";
import {
  createAccount,
  getAccountContext,
  getOrCreateTelegramUser,
  registerWallet,
  setSignerStatus,
  updateSettings,
  type AccountContext
} from "../../lib/services/accounts";
import { activateAutomation, changeAutomationStatus, describeAutomation, listAutomations, prepareAutomation } from "../../lib/services/automations";
import { archiveDestination, confirmDestination, listDestinations, proposeDestination, type DestinationCategory } from "../../lib/services/destinations";
import { UserFacingError } from "../../lib/services/errors";
import { currentPolicyLimits, loadPermissionState } from "../../lib/services/permission";
import { listExecutions, reconcileExecutions, runDueAutomations, runNow, type ExecutionDeps } from "../../lib/services/executions";
import { executionMessage } from "../../lib/services/notifications";
import type { InlineKeyboard, TelegramUpdate } from "../../lib/telegram/api";
import { handleUpdate, type BotDeps } from "../../lib/telegram/bot";
import { formatUsdcAmount, MONAD_TESTNET_USDC_ADDRESS, parseUsdcAmount } from "../../lib/usdc";
import { expectedPolicyFingerprint } from "../../lib/wallet/policy";

export type AccountType = "INDIVIDUAL" | "BUSINESS";
type SampleFn = ((input: string, options?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json: <T>(input: string, options?: Record<string, unknown>) => Promise<T>;
};

const TELEGRAM_ID = 4242;
export const TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

// ---------- Observable sandbox state (for React via useSyncExternalStore) ----------

export type ChatLine = { id: number; from: "user" | "bot" | "system"; text: string; keyboard?: InlineKeyboard };
export type AiMode = "pending" | "live" | "canned";

type Snapshot = {
  accountType: AccountType;
  now: Date;
  chat: ChatLine[];
  unread: number;
  aiMode: AiMode;
  busy: boolean;
  version: number;
};

let snapshot: Snapshot = { accountType: "BUSINESS", now: new Date(), chat: [], unread: 0, aiMode: "pending", busy: false, version: 0 };
const listeners = new Set<() => void>();
function update(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch, version: snapshot.version + 1 };
  listeners.forEach((l) => l());
}
export const sandboxStore = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => snapshot
};

/** Fired whenever sandbox data changes outside the dashboard (bot, clock, funding). */
export const DATA_CHANGED = "auctra-sandbox:data-changed";
const dataChanged = () => window.dispatchEvent(new Event(DATA_CHANGED));

let db: Db | null = null;
let walletAddress: Address = "0x0000000000000000000000000000000000000000";
const balances = new Map<string, bigint>();
let sample: SampleFn | null = null;
let nextLineId = 1;
let nextUpdateId = 1;

// ---------- Canned readings (used only when live Claude reading is unavailable) ----------

const none: Extraction = {
  outcome: "TRANSFER_REQUEST", unsupportedReason: null, amount: null, asset: null, destinationLabel: null,
  destinationAddress: null, frequency: null, date: null, dayOfWeek: null, dayOfMonth: null, time: null, minBalance: null, memo: null
};
const CANNED: Record<string, Extraction> = {
  "Save 20 USDC to my savings wallet every Friday at 6 PM": { ...none, amount: "20", asset: "USDC", destinationLabel: "my savings wallet", frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "18:00" },
  "Send 50 USDC to my savings wallet every Monday at 9:00 only if my balance is at least 300": { ...none, amount: "50", asset: "USDC", destinationLabel: "my savings wallet", frequency: "WEEKLY", dayOfWeek: "MONDAY", time: "09:00", minBalance: "300" },
  "Never let my wallet fall below 300 USDC": { ...none, outcome: "SET_BALANCE_FLOOR", amount: "300" },
  "Pay Acme Hosting 80 USDC on the 1st of every month at 9:00, memo INV hosting": { ...none, amount: "80", asset: "USDC", destinationLabel: "Acme Hosting", frequency: "MONTHLY", dayOfMonth: 1, time: "09:00", memo: "INV hosting" },
  "Pay Acme Hosting 80 USDC on the 1st of every month at 9:00": { ...none, amount: "80", asset: "USDC", destinationLabel: "Acme Hosting", frequency: "MONTHLY", dayOfMonth: 1, time: "09:00" },
  "Pay Ada Obi 100 USDC every Friday at 5 PM": { ...none, amount: "100", asset: "USDC", destinationLabel: "Ada Obi", frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "17:00" },
  "Move 50 USDC to the reserve wallet every Monday at 10:00 if the balance is at least 500": { ...none, amount: "50", asset: "USDC", destinationLabel: "reserve wallet", frequency: "WEEKLY", dayOfWeek: "MONDAY", time: "10:00", minBalance: "500" },
  "Buy MON when the price drops 5%": { ...none, outcome: "UNSUPPORTED", unsupportedReason: "Auctra doesn't trade tokens." }
};
export const CHAT_EXAMPLES: Record<AccountType, string[]> = {
  INDIVIDUAL: ["Save 20 USDC to my savings wallet every Friday at 6 PM", "Never let my wallet fall below 300 USDC", "Buy MON when the price drops 5%"],
  BUSINESS: ["Pay Ada Obi 100 USDC every Friday at 5 PM", "Move 50 USDC to the reserve wallet every Monday at 10:00 if the balance is at least 500", "Buy MON when the price drops 5%"]
};
export function canReadText(text: string) {
  return snapshot.aiMode === "live" || text in CANNED;
}

const EXTRACTION_FORMAT = `Reply with only one JSON object with exactly these keys (use null for anything the message does not state):
{"outcome": "TRANSFER_REQUEST" | "SET_BALANCE_FLOOR" | "UNSUPPORTED" | "NOT_A_REQUEST", "unsupportedReason": string|null, "amount": string|null, "asset": string|null, "destinationLabel": string|null, "destinationAddress": string|null, "frequency": "ONCE"|"DAILY"|"WEEKLY"|"MONTHLY"|null, "date": "YYYY-MM-DD"|null, "dayOfWeek": "MONDAY"|"TUESDAY"|"WEDNESDAY"|"THURSDAY"|"FRIDAY"|"SATURDAY"|"SUNDAY"|null, "dayOfMonth": number|null, "time": "HH:mm"|null, "minBalance": string|null, "memo": string|null}`;

class NotReadable extends Error {}

const intentModel: IntentModel = async ({ message, today, timezone }) => {
  // A clarification answer is appended to the original request; match its last line too.
  const canned = CANNED[message] ?? CANNED[message.split("\n").pop() ?? ""];
  if (canned && snapshot.aiMode !== "live") return canned;
  if (!sample) throw new NotReadable();
  try {
    return await sample.json<Extraction>(
      `${SYSTEM_PROMPT}\n\n${EXTRACTION_FORMAT}\n\nCurrent date: ${today} (timezone ${timezone}).\n\nMessage:\n<message>\n${message}\n</message>`,
      { modelTier: "quick" }
    );
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "not_granted" || code === "sampling_disabled" || code === "capability_disabled") {
      sample = null;
      update({ aiMode: "canned" });
    }
    if (canned) return canned;
    throw new NotReadable();
  }
};

export function initClaude() {
  const claude = (window as unknown as { claude?: { use: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) {
    update({ aiMode: "canned" });
    return;
  }
  claude
    .use("sample")
    .then((s) => {
      sample = (s as SampleFn | null) ?? null;
      update({ aiMode: sample ? "live" : "canned" });
    })
    .catch(() => update({ aiMode: "canned" }));
}

// ---------- Simulated chain + wallet ----------

function randomHash(): Hex {
  return `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function executionDeps(): ExecutionDeps {
  return {
    signer: {
      async sendTransaction(_walletId, call) {
        if (getAddress(call.to) !== MONAD_TESTNET_USDC_ADDRESS) throw new Error("The simulated chain only knows USDC.");
        const { args } = decodeFunctionData({ abi: erc20Abi, data: call.data });
        const [to, amount] = args as [Address, bigint];
        const balance = balances.get(walletAddress) ?? BigInt(0);
        if (balance < amount) throw Object.assign(new Error("Transfer amount exceeds balance"), { rejected: true });
        balances.set(walletAddress, balance - amount);
        balances.set(getAddress(to), (balances.get(getAddress(to)) ?? BigInt(0)) + amount);
        return { hash: randomHash() };
      }
    },
    readUsdcBalance: async (owner) => balances.get(getAddress(owner)) ?? BigInt(0),
    waitForReceipt: async () => "success",
    isProviderRejection: (error) => Boolean((error as { rejected?: boolean })?.rejected),
    notify: async (notice) => addLine("bot", executionMessage(notice))
  };
}

// ---------- Telegram (the real bot, local transport) ----------

function addLine(from: ChatLine["from"], text: string, keyboard?: InlineKeyboard) {
  const shown = text.replace(/https:\/\/testnet\.monadexplorer\.com\/tx\/0x[0-9a-f]+/g, "(simulated transaction: not on chain)");
  update({
    chat: [...snapshot.chat, { id: nextLineId++, from, text: shown, keyboard }],
    unread: from === "bot" ? snapshot.unread + 1 : snapshot.unread
  });
}
export function markChatRead() {
  if (snapshot.unread) update({ unread: 0 });
}

function botDeps(): BotDeps {
  return {
    db: db!,
    telegram: {
      async sendMessage(_chatId, text, keyboard) {
        addLine("bot", text, keyboard?.inline_keyboard.length ? keyboard : undefined);
      },
      async answerCallbackQuery() {},
      async clearKeyboard(_chatId, messageId) {
        update({ chat: snapshot.chat.map((l) => (l.id === messageId ? { ...l, keyboard: undefined } : l)) });
      }
    },
    intentModel,
    appUrl: "https://auctra.example",
    readBalances: async (address) => ({ mon: BigInt("4210000000000000000"), usdc: balances.get(getAddress(address)) ?? BigInt(0) }),
    execution: executionDeps(),
    onDestinationsChanged: async () => {},
    now: () => snapshot.now
  };
}

async function busy<T>(task: () => Promise<T>) {
  update({ busy: true });
  try {
    return await task();
  } finally {
    update({ busy: false });
    dataChanged();
  }
}

export async function sendChat(text: string) {
  if (snapshot.busy || !text.trim()) return;
  addLine("user", text);
  if (!text.startsWith("/") && !canReadText(text)) {
    addLine("system", "Live plain-English reading isn't available in this view. Tap an example, or use a command like /automations.");
    return;
  }
  const update_: TelegramUpdate = {
    update_id: nextUpdateId++,
    message: { message_id: nextLineId, chat: { id: TELEGRAM_ID, type: "private" }, from: { id: TELEGRAM_ID }, text }
  };
  await busy(() => handleUpdate(botDeps(), update_).catch((e) => addLine("system", `Sandbox error: ${(e as Error).message}`)));
}

export async function tapChatButton(messageId: number, data: string, label: string) {
  if (snapshot.busy) return;
  addLine("system", `Tapped “${label}”`);
  const update_: TelegramUpdate = {
    update_id: nextUpdateId++,
    callback_query: { id: `cb${nextUpdateId}`, from: { id: TELEGRAM_ID }, data, message: { message_id: messageId, chat: { id: TELEGRAM_ID, type: "private" } } }
  };
  await busy(() => handleUpdate(botDeps(), update_).catch((e) => addLine("system", `Sandbox error: ${(e as Error).message}`)));
}

// ---------- Boot + seed ----------

const SEED: Record<AccountType, { label: string; address: string; category: DestinationCategory }[]> = {
  INDIVIDUAL: [{ label: "Savings wallet", address: "0x2222222222222222222222222222222222222222", category: "SAVINGS" }],
  BUSINESS: [
    { label: "Acme Hosting", address: "0x3333333333333333333333333333333333333333", category: "VENDOR" },
    { label: "Ada Obi", address: "0x4444444444444444444444444444444444444444", category: "CONTRACTOR" },
    { label: "Reserve wallet", address: "0x5555555555555555555555555555555555555555", category: "TREASURY" }
  ]
};

let assets: { wasm: WebAssembly.Module; data: Blob } | null = null;
async function loadAssets() {
  if (assets) return assets;
  const [wasm, data] = await Promise.all([
    fetch("pglite.wasm").then((r) => {
      if (!r.ok) throw new Error(`pglite.wasm: HTTP ${r.status}`);
      return WebAssembly.compileStreaming ? WebAssembly.compileStreaming(r) : r.arrayBuffer().then((b) => WebAssembly.compile(b));
    }),
    // Shipped as base64 text: the artifact host serves no raw binary data files.
    fetch("pglite-data.txt").then(async (r) => {
      if (!r.ok) throw new Error(`pglite-data.txt: HTTP ${r.status}`);
      const binary = atob((await r.text()).trim());
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes]);
    })
  ]);
  assets = { wasm, data };
  return assets;
}

/** Simulated grant: records the permission as verified for the account's current limits. No Privy involved. */
async function simulateVerifiedGrant(accountId: string, userId: string) {
  const limits = await currentPolicyLimits(db!, accountId);
  if (!limits) throw new UserFacingError("NO_DESTINATIONS", "Save at least one destination before granting Auctra permission.");
  await setSignerStatus(db!, { accountId, userId, status: "GRANTED", privyPolicyId: "sandbox-policy", policyFingerprint: expectedPolicyFingerprint(limits) });
}

export async function boot(type: AccountType) {
  const { wasm, data } = await loadAssets();
  const client = await PGlite.create({ wasmModule: wasm, fsBundle: data });
  for (const sql of [initSql, pendingSql, policyFingerprintSql]) {
    for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await client.exec(statement);
  }
  db = drizzle(client, { schema }) as unknown as Db;
  balances.clear();
  nextLineId = 1;

  const user = await getOrCreateTelegramUser(db, { telegramId: String(TELEGRAM_ID), chatId: String(TELEGRAM_ID) });
  const account = await createAccount(db, { userId: user.id, type, businessName: type === "BUSINESS" ? "Acme Labs" : undefined, timezone: TIMEZONE });
  walletAddress = getAddress(type === "BUSINESS" ? "0x7a3f9c21b04de8a5c6f1e2d3b4a5968778899abc" : "0x1c0ffee2541f0b3d9e8a7c6b5a4d3e2f1a0b9c8d");
  await registerWallet(db, { accountId: account.id, userId: user.id, privyWalletId: "sandbox-wallet", address: walletAddress, chainId: 10143 });
  for (const d of SEED[type]) {
    const proposal = await proposeDestination(db, { userId: user.id, accountId: account.id, walletAddress, ...d });
    await confirmDestination(db, { confirmationId: proposal.confirmationId, userId: user.id, accountId: account.id });
  }
  await simulateVerifiedGrant(account.id, user.id);
  balances.set(walletAddress, parseUsdcAmount(type === "BUSINESS" ? "1342.5" : "500"));

  update({ accountType: type, now: new Date(), chat: [], unread: 0, busy: false });
  addLine("bot", "Welcome to Auctra. Tell me what you want your money to do, or send /help.");
  update({ unread: 0 });
}

// ---------- Sandbox controls ----------

async function context(): Promise<AccountContext & { account: NonNullable<AccountContext["account"]>; wallet: NonNullable<AccountContext["wallet"]> }> {
  const ctx = await getAccountContext(db!, { telegramId: String(TELEGRAM_ID) });
  return ctx as AccountContext & { account: NonNullable<AccountContext["account"]>; wallet: NonNullable<AccountContext["wallet"]> };
}

/** Moves the demo clock to the next scheduled run and lets the real scheduler run. */
export async function jumpToNextRun(): Promise<string> {
  return busy(async () => {
    const ctx = await context();
    const rows = await listAutomations(db!, ctx.account.id, ["ACTIVE"]);
    const next = rows
      .map((r) => r.automation.nextRunAt)
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (!next) return "No active automations to run. Create one first.";
    update({ now: new Date(next.getTime() + 1000) });
    await reconcileExecutions(db!, executionDeps(), snapshot.now);
    const results = await runDueAutomations(db!, executionDeps(), snapshot.now);
    return results.length === 1 ? "The scheduler ran 1 automation." : `The scheduler ran ${results.length} automations.`;
  });
}

export async function addFunds(amount: string) {
  balances.set(walletAddress, (balances.get(walletAddress) ?? BigInt(0)) + parseUsdcAmount(amount));
  dataChanged();
}

// ---------- In-page API: the same /api/* contract as app/api/** ----------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const fail = (code: string, message: string, status = 400) => json({ error: { code, message } }, status);
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export async function handleApi(method: string, pathname: string, body: unknown): Promise<Response> {
  if (!db) return fail("NOT_READY", "The sandbox is still starting.", 503);
  try {
    const ctx = await context();
    const input = (body ?? {}) as Record<string, string>;
    const route = `${method} ${pathname.replace(/\/[0-9a-f-]{36}(?=\/|$)/, "/:id")}`;
    const id = pathname.match(/[0-9a-f-]{36}/)?.[0] ?? "";

    switch (route) {
      case "POST /api/auth/session":
        return json({ linked: true, hasAccount: true, hasWallet: true });
      case "GET /api/me":
        return json({
          linked: true,
          user: { timezone: ctx.user.timezone },
          account: { id: ctx.account.id, type: ctx.account.type, businessName: ctx.account.businessName },
          wallet: {
            address: ctx.wallet.address,
            chainId: ctx.wallet.chainId,
            signerStatus: ctx.wallet.signerStatus,
            permission: await loadPermissionState(db, ctx.wallet),
            balanceFloor: ctx.wallet.balanceFloor
          },
          limits: { maxTransferUsdc: AuctraConfig.maxTransferUsdc, dailyCapUsdc: AuctraConfig.dailyCapUsdc }
        });
      case "GET /api/balance":
        return json({ network: "Monad Testnet", address: walletAddress, usdc: formatUsdcAmount(balances.get(walletAddress) ?? BigInt(0)), mon: "4.2100" });
      case "GET /api/automations": {
        const rows = await listAutomations(db, ctx.account.id);
        return json(
          plain({
            automations: rows.map(({ automation, destination }) => ({
              ...automation,
              description: describeAutomation(automation, destination),
              destination: { id: destination.id, label: destination.label, address: destination.address, category: destination.category }
            }))
          })
        );
      }
      case "POST /api/automations":
        return json(plain({ automation: await activateAutomation(db, ctx, input.confirmationId, snapshot.now) }));
      case "PATCH /api/automations/:id":
        return json(
          plain({ automation: await changeAutomationStatus(db, { userId: ctx.user.id, accountId: ctx.account.id, automationId: id, action: input.action as "pause" }, snapshot.now) })
        );
      case "POST /api/automations/:id/run":
        return json(
          plain({ execution: await runNow(db, executionDeps(), { accountId: ctx.account.id, automationId: id, requestId: input.requestId, userId: ctx.user.id }, snapshot.now) })
        );
      case "GET /api/destinations":
        return json(plain({ destinations: await listDestinations(db, ctx.account.id) }));
      case "POST /api/destinations":
        return json(
          await proposeDestination(db, {
            userId: ctx.user.id,
            accountId: ctx.account.id,
            walletAddress: ctx.wallet.address,
            label: input.label,
            address: input.address,
            category: input.category as DestinationCategory
          })
        );
      case "POST /api/destinations/confirm":
        return json(plain({ destination: await confirmDestination(db, { confirmationId: input.confirmationId, userId: ctx.user.id, accountId: ctx.account.id }) }));
      case "DELETE /api/destinations/:id":
        return json(plain(await archiveDestination(db, { userId: ctx.user.id, accountId: ctx.account.id, destinationId: id })));
      case "GET /api/executions": {
        const rows = await listExecutions(db, ctx.account.id);
        return json(
          plain({
            executions: rows.map(({ execution, automation, destination }) => ({
              ...execution,
              memo: automation.memo,
              destination: { label: destination.label, category: destination.category },
              // Simulated hashes aren't on chain, so there is no explorer page to open.
              explorerUrl: null
            }))
          })
        );
      }
      case "POST /api/ai/intent": {
        let result;
        try {
          result = await parseIntent(intentModel, { message: input.message, timezone: ctx.user.timezone, now: snapshot.now });
        } catch (error) {
          if (error instanceof NotReadable) {
            return fail("NOT_READABLE", "Live plain-English reading isn't available in this view. Pick one of the examples to try it.");
          }
          throw error;
        }
        if (result.kind !== "intent") return json(result);
        return json(await prepareAutomation(db, ctx, result.intent, snapshot.now));
      }
      case "PATCH /api/settings":
        await updateSettings(db, { userId: ctx.user.id, accountId: ctx.account.id, ...(input as { timezone?: string; balanceFloor?: string | null }) });
        return json({ ok: true });
      case "GET /api/onboarding/signer": {
        const destinations = await listDestinations(db, ctx.account.id);
        if (destinations.length === 0) return fail("NO_DESTINATIONS", "Save at least one destination before granting Auctra permission.");
        return json({
          address: ctx.wallet.address,
          signerId: "sandbox-signer",
          policyId: "sandbox-policy",
          permission: await loadPermissionState(db, ctx.wallet),
          review: {
            network: "Monad Testnet",
            chainId: 10143,
            asset: "USDC",
            contract: MONAD_TESTNET_USDC_ADDRESS,
            maxTransferUsdc: AuctraConfig.maxTransferUsdc,
            dailyCapUsdc: AuctraConfig.dailyCapUsdc,
            recipients: destinations.map((d) => ({ label: d.label, address: d.address }))
          }
        });
      }
      case "POST /api/onboarding/signer": {
        // Simulated: there is no Privy here, so the grant is recorded as if verified.
        if (input.action === "granted") {
          await simulateVerifiedGrant(ctx.account.id, ctx.user.id);
          return json({ permission: "VERIFIED" });
        }
        await setSignerStatus(db, { accountId: ctx.account.id, userId: ctx.user.id, status: "REVOKED" });
        return json({ permission: "REVOKED" });
      }
      default:
        return fail("NOT_FOUND", "Not available in the sandbox.", 404);
    }
  } catch (error) {
    if (error instanceof UserFacingError) return fail(error.code, error.message, error.code === "NOT_FOUND" ? 404 : 400);
    console.error(error);
    return fail("INTERNAL", "Something went wrong.", 500);
  }
}

/** Routes the dashboard's fetch("/api/...") calls to handleApi; everything else passes through. */
export function installFetch() {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("/api/")) return original(input, init);
    const { pathname, searchParams } = new URL(url, "https://sandbox.local");
    if (pathname === "/api/executions" && searchParams.get("format") === "csv") {
      return fail("UNAVAILABLE", "CSV export isn't available in the sandbox.", 400);
    }
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    return handleApi((init?.method ?? "GET").toUpperCase(), pathname, body);
  };
}

