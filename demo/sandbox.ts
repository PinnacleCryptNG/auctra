// Auctra sandbox: the real bot, services, scheduler and validation running in the
// browser on PGlite (Postgres in WebAssembly). Only the edges are simulated:
// the wallet/chain, the clock, and Telegram's transport.

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { decodeFunctionData, erc20Abi, getAddress, type Address, type Hex } from "viem";
import initSql from "../drizzle/0000_init.sql";
import pendingSql from "../drizzle/0001_pending_request.sql";
import type { Db } from "../db/client";
import * as schema from "../db/schema";
import { SYSTEM_PROMPT, type Extraction, type IntentModel } from "../lib/ai/intent-parser";
import { formatDateTime, formatUsdc } from "../lib/format";
import { getAccountContext, createAccount, getOrCreateTelegramUser, registerWallet, setSignerStatus } from "../lib/services/accounts";
import { listAutomations } from "../lib/services/automations";
import { confirmDestination, listDestinations, proposeDestination, type DestinationCategory } from "../lib/services/destinations";
import { listExecutions, reconcileExecutions, runDueAutomations, type ExecutionDeps } from "../lib/services/executions";
import { executionMessage } from "../lib/services/notifications";
import type { InlineKeyboard, TelegramUpdate } from "../lib/telegram/api";
import { handleUpdate, type BotDeps } from "../lib/telegram/bot";
import { formatUsdcAmount, MONAD_TESTNET_USDC_ADDRESS, parseUsdcAmount } from "../lib/usdc";

type SampleFn = ((input: string, options?: Record<string, unknown>) => Promise<{ text: string }>) & {
  json: <T>(input: string, options?: Record<string, unknown>) => Promise<T>;
};
declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<unknown> };
  }
}

const TELEGRAM_ID = 4242;
const TIMEZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- Canned extractions, used only when live Claude parsing is unavailable ----------

const none: Extraction = {
  outcome: "TRANSFER_REQUEST", unsupportedReason: null, amount: null, asset: null, destinationLabel: null,
  destinationAddress: null, frequency: null, date: null, dayOfWeek: null, dayOfMonth: null, time: null, minBalance: null, memo: null
};
const EXAMPLES: Record<"INDIVIDUAL" | "BUSINESS", { text: string; extraction: Extraction }[]> = {
  INDIVIDUAL: [
    { text: "Save 20 USDC to my savings wallet every Friday at 6 PM", extraction: { ...none, amount: "20", asset: "USDC", destinationLabel: "my savings wallet", frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "18:00" } },
    { text: "Send 50 USDC to my savings wallet every Monday at 9:00 only if my balance is at least 300", extraction: { ...none, amount: "50", asset: "USDC", destinationLabel: "my savings wallet", frequency: "WEEKLY", dayOfWeek: "MONDAY", time: "09:00", minBalance: "300" } },
    { text: "Never let my wallet fall below 300 USDC", extraction: { ...none, outcome: "SET_BALANCE_FLOOR", amount: "300" } },
    { text: "Buy MON when the price drops 5%", extraction: { ...none, outcome: "UNSUPPORTED", unsupportedReason: "Auctra doesn't trade tokens." } }
  ],
  BUSINESS: [
    { text: "Pay Acme Hosting 80 USDC on the 1st of every month at 09:00, memo INV hosting", extraction: { ...none, amount: "80", asset: "USDC", destinationLabel: "Acme Hosting", frequency: "MONTHLY", dayOfMonth: 1, time: "09:00", memo: "INV hosting" } },
    { text: "Pay Ada Obi 100 USDC every Friday at 17:00", extraction: { ...none, amount: "100", asset: "USDC", destinationLabel: "Ada Obi", frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "17:00" } },
    { text: "Move 50 USDC to the reserve wallet every Monday at 10:00 if the balance is at least 500", extraction: { ...none, amount: "50", asset: "USDC", destinationLabel: "reserve wallet", frequency: "WEEKLY", dayOfWeek: "MONDAY", time: "10:00", minBalance: "500" } },
    { text: "Never let our wallet fall below 1000 USDC", extraction: { ...none, outcome: "SET_BALANCE_FLOOR", amount: "1000" } }
  ]
};

const EXTRACTION_FORMAT = `Reply with only one JSON object with exactly these keys (use null for anything the message does not state):
{"outcome": "TRANSFER_REQUEST" | "SET_BALANCE_FLOOR" | "UNSUPPORTED" | "NOT_A_REQUEST", "unsupportedReason": string|null, "amount": string|null, "asset": string|null, "destinationLabel": string|null, "destinationAddress": string|null, "frequency": "ONCE"|"DAILY"|"WEEKLY"|"MONTHLY"|null, "date": "YYYY-MM-DD"|null, "dayOfWeek": "MONDAY"|"TUESDAY"|"WEDNESDAY"|"THURSDAY"|"FRIDAY"|"SATURDAY"|"SUNDAY"|null, "dayOfMonth": number|null, "time": "HH:mm"|null, "minBalance": string|null, "memo": string|null}`;

// ---------- State ----------

type ChatLine = { id: number; from: "user" | "bot" | "system"; text: string; keyboard?: InlineKeyboard };

const state = {
  db: null as Db | null,
  accountType: "BUSINESS" as "INDIVIDUAL" | "BUSINESS",
  now: new Date(),
  balances: new Map<string, bigint>(),
  walletAddress: "" as Address,
  chat: [] as ChatLine[],
  nextId: 1,
  updateId: 1,
  busy: false,
  sample: null as SampleFn | null,
  aiMode: "pending" as "pending" | "live" | "canned",
  lastCanned: new Map<string, Extraction>()
};

// ---------- Simulated chain + wallet ----------

function randomHash(): Hex {
  return `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function executionDeps(): ExecutionDeps {
  return {
    signer: {
      async sendTransaction(_walletId, call) {
        if (getAddress(call.to) !== MONAD_TESTNET_USDC_ADDRESS) throw new Error("Simulated chain only knows USDC.");
        const { args } = decodeFunctionData({ abi: erc20Abi, data: call.data });
        const [to, amount] = args as [Address, bigint];
        const from = state.walletAddress;
        const balance = state.balances.get(from) ?? BigInt(0);
        if (balance < amount) throw Object.assign(new Error("ERC20: transfer amount exceeds balance"), { rejected: true });
        state.balances.set(from, balance - amount);
        state.balances.set(getAddress(to), (state.balances.get(getAddress(to)) ?? BigInt(0)) + amount);
        return { hash: randomHash() };
      }
    },
    readUsdcBalance: async (owner) => state.balances.get(getAddress(owner)) ?? BigInt(0),
    waitForReceipt: async () => "success",
    isProviderRejection: (error) => Boolean((error as { rejected?: boolean })?.rejected),
    notify: async (notice) => {
      addLine("bot", executionMessage(notice));
    }
  };
}

// ---------- Claude (live through the viewer's account, or canned) ----------

const intentModel: IntentModel = async ({ message, today, timezone }) => {
  const canned = state.lastCanned.get(message);
  if (canned) return canned;
  if (!state.sample) {
    return { ...none, outcome: "NOT_A_REQUEST" };
  }
  const prompt = `${SYSTEM_PROMPT}\n\n${EXTRACTION_FORMAT}\n\nCurrent date: ${today} (timezone ${timezone}).\n\nMessage:\n<message>\n${message}\n</message>`;
  try {
    return await state.sample.json<Extraction>(prompt, { modelTier: "quick" });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "not_granted" || code === "sampling_disabled" || code === "capability_disabled") {
      state.sample = null;
      state.aiMode = "canned";
      renderAiStatus();
      addLine("system", "Live parsing was declined, so only the example requests work now.");
    }
    throw error;
  }
};

// ---------- Bot wiring ----------

function botDeps(): BotDeps {
  return {
    db: state.db!,
    telegram: {
      async sendMessage(_chatId, text, keyboard) {
        addLine("bot", text, keyboard?.inline_keyboard.length ? keyboard : undefined);
      },
      async answerCallbackQuery() {},
      async clearKeyboard(_chatId, messageId) {
        const line = state.chat.find((l) => l.id === messageId);
        if (line) line.keyboard = undefined;
        renderChat();
      }
    },
    intentModel,
    appUrl: "https://auctra.example",
    readBalances: async (address) => ({ mon: BigInt("4210000000000000000"), usdc: state.balances.get(getAddress(address)) ?? BigInt(0) }),
    execution: executionDeps(),
    onDestinationsChanged: async () => {},
    now: () => state.now
  };
}

function addLine(from: ChatLine["from"], text: string, keyboard?: InlineKeyboard) {
  // Simulated hashes don't exist on Monad Testnet, so don't present explorer links as real.
  const shown = text.replace(/https:\/\/testnet\.monadexplorer\.com\/tx\/0x[0-9a-f]+/g, "(simulated transaction: not on chain)");
  state.chat.push({ id: state.nextId++, from, text: shown, keyboard });
  renderChat();
}

async function sendText(text: string) {
  if (state.busy || !text.trim()) return;
  addLine("user", text);
  if (!text.startsWith("/") && state.aiMode !== "live" && !state.lastCanned.has(text)) {
    addLine("system", "Live plain-English parsing isn't available in this view, so typed requests can't be read. Tap one of the example requests, or use a command like /automations.");
    return;
  }
  const update: TelegramUpdate = {
    update_id: state.updateId++,
    message: { message_id: state.nextId, chat: { id: TELEGRAM_ID, type: "private" }, from: { id: TELEGRAM_ID }, text }
  };
  await runBusy(text.startsWith("/") ? null : "Reading your request…", () => handleUpdate(botDeps(), update));
}

async function tapButton(messageId: number, data: string, label: string) {
  if (state.busy) return;
  addLine("system", `Tapped “${label}”`);
  const update: TelegramUpdate = {
    update_id: state.updateId++,
    callback_query: { id: `cb${state.updateId}`, from: { id: TELEGRAM_ID }, data, message: { message_id: messageId, chat: { id: TELEGRAM_ID, type: "private" } } }
  };
  await runBusy(null, () => handleUpdate(botDeps(), update));
}

async function runBusy(label: string | null, task: () => Promise<void>) {
  state.busy = true;
  $("typing").hidden = !label;
  $("typing").textContent = label ?? "";
  renderComposer();
  try {
    await task();
  } catch (error) {
    console.error(error);
    addLine("system", `Something failed in the sandbox: ${(error as Error).message ?? error}`);
  } finally {
    state.busy = false;
    $("typing").hidden = true;
    renderComposer();
    await renderPanel();
  }
}

// ---------- Seed ----------

const SEED: Record<"INDIVIDUAL" | "BUSINESS", { label: string; address: string; category: DestinationCategory }[]> = {
  INDIVIDUAL: [{ label: "Savings wallet", address: "0x2222222222222222222222222222222222222222", category: "SAVINGS" }],
  BUSINESS: [
    { label: "Acme Hosting", address: "0x3333333333333333333333333333333333333333", category: "VENDOR" },
    { label: "Ada Obi", address: "0x4444444444444444444444444444444444444444", category: "CONTRACTOR" },
    { label: "Reserve wallet", address: "0x5555555555555555555555555555555555555555", category: "TREASURY" }
  ]
};

async function boot(type: "INDIVIDUAL" | "BUSINESS") {
  $("boot").hidden = false;
  $("boot-text").textContent = "Starting Postgres in your browser…";
  state.accountType = type;
  state.chat = [];
  state.nextId = 1;
  state.now = new Date();
  state.balances = new Map();

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
  const client = await PGlite.create({ wasmModule: wasm, fsBundle: data });
  for (const sql of [initSql, pendingSql]) {
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
  const db = drizzle(client, { schema }) as unknown as Db;
  state.db = db;

  $("boot-text").textContent = "Setting up the demo account…";
  const user = await getOrCreateTelegramUser(db, { telegramId: String(TELEGRAM_ID), chatId: String(TELEGRAM_ID) });
  const account = await createAccount(db, {
    userId: user.id,
    type,
    businessName: type === "BUSINESS" ? "Acme Labs" : undefined,
    timezone: TIMEZONE
  });
  state.walletAddress = getAddress(type === "BUSINESS" ? "0x7a3f9c21b04de8a5c6f1e2d3b4a5968778899abc" : "0x1c0ffee2541f0b3d9e8a7c6b5a4d3e2f1a0b9c8d");
  await registerWallet(db, { accountId: account.id, userId: user.id, privyWalletId: "sandbox-wallet", address: state.walletAddress });
  await setSignerStatus(db, { accountId: account.id, userId: user.id, status: "GRANTED", privyPolicyId: "sandbox-policy" });
  for (const d of SEED[type]) {
    const proposal = await proposeDestination(db, { userId: user.id, accountId: account.id, walletAddress: state.walletAddress, ...d });
    await confirmDestination(db, { confirmationId: proposal.confirmationId, userId: user.id, accountId: account.id });
  }
  state.balances.set(state.walletAddress, parseUsdcAmount(type === "BUSINESS" ? "1342.5" : "500"));

  addLine(
    "system",
    type === "BUSINESS"
      ? "You're Acme Labs (business). Saved destinations: Acme Hosting (vendor), Ada Obi (contractor), Reserve wallet (treasury)."
      : "You're a personal account. Saved destination: Savings wallet."
  );
  addLine("bot", "Welcome to Auctra. Tell me what you want your money to do, or send /help.");
  $("boot").hidden = true;
  renderExamples();
  renderComposer();
  await renderPanel();
}

// ---------- Clock + controls ----------

async function advanceToNextRun() {
  const db = state.db!;
  const ctx = (await getAccountContext(db, { telegramId: String(TELEGRAM_ID) }))!;
  const rows = await listAutomations(db, ctx.account!.id, ["ACTIVE"]);
  const next = rows.map((r) => r.automation.nextRunAt).filter((d): d is Date => Boolean(d)).sort((a, b) => a.getTime() - b.getTime())[0];
  if (!next) {
    addLine("system", "No active automations to run. Create one first.");
    return;
  }
  state.now = new Date(next.getTime() + 1000);
  addLine("system", `Clock moved to ${formatDateTime(state.now, TIMEZONE)}. The scheduler runs now.`);
  await runBusy(null, async () => {
    await reconcileExecutions(db, executionDeps(), state.now);
    const results = await runDueAutomations(db, executionDeps(), state.now);
    if (results.length === 0) addLine("system", "Nothing was due.");
  });
}

async function setPermission(granted: boolean) {
  const db = state.db!;
  const ctx = (await getAccountContext(db, { telegramId: String(TELEGRAM_ID) }))!;
  await setSignerStatus(db, { accountId: ctx.account!.id, userId: ctx.user.id, status: granted ? "GRANTED" : "REVOKED" });
  addLine("system", granted ? "Auctra's signing permission granted again." : "Auctra's signing permission revoked. Payments will now be blocked.");
  await renderPanel();
}

async function fund(amount: string) {
  state.balances.set(state.walletAddress, (state.balances.get(state.walletAddress) ?? BigInt(0)) + parseUsdcAmount(amount));
  addLine("system", `Added ${amount} test USDC to the wallet.`);
  await renderPanel();
}

// ---------- Rendering ----------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderChat() {
  const log = $("chat-log");
  log.replaceChildren(
    ...state.chat.map((line) => {
      const bubble = el("div", `msg ${line.from}`);
      bubble.append(el("div", "msg-text", line.text));
      if (line.keyboard) {
        const row = el("div", "msg-buttons");
        for (const button of line.keyboard.inline_keyboard.flat()) {
          if (!("callback_data" in button)) continue;
          const b = el("button", "inline-btn", button.text);
          b.type = "button";
          b.onclick = () => tapButton(line.id, button.callback_data, button.text);
          row.append(b);
        }
        bubble.append(row);
      }
      return bubble;
    })
  );
  log.scrollTop = log.scrollHeight;
}

function renderComposer() {
  ($("chat-input") as HTMLInputElement).disabled = state.busy || !state.db;
  ($("chat-send") as HTMLButtonElement).disabled = state.busy || !state.db;
  for (const b of document.querySelectorAll<HTMLButtonElement>(".example, .control")) b.disabled = state.busy || !state.db;
}

function renderExamples() {
  const wrap = $("examples");
  wrap.replaceChildren(
    ...EXAMPLES[state.accountType].map(({ text, extraction }) => {
      const b = el("button", "example", text);
      b.type = "button";
      b.onclick = () => {
        if (state.aiMode !== "live") state.lastCanned.set(text, extraction);
        sendText(text);
      };
      return b;
    }),
    ...["/automations", "/run", "/pause", "/history", "/balance"].map((cmd) => {
      const b = el("button", "example command", cmd);
      b.type = "button";
      b.onclick = () => sendText(cmd);
      return b;
    })
  );
}

function renderAiStatus() {
  const s = $("ai-status");
  s.dataset.mode = state.aiMode;
  s.textContent =
    state.aiMode === "live"
      ? "Plain-English parsing: live Claude (asks your permission on first use)"
      : state.aiMode === "canned"
        ? "Plain-English parsing: unavailable here, so the example requests use pre-recorded parses"
        : "Checking for Claude…";
}

const STATUS_CLASS: Record<string, string> = {
  CONFIRMED: "ok", ACTIVE: "ok", SUBMITTED: "warn", PENDING: "warn", PAUSED: "warn", SKIPPED: "warn",
  FAILED: "bad", REJECTED: "bad", UNKNOWN: "bad", CANCELLED: "muted", COMPLETED: "muted"
};

async function renderPanel() {
  const db = state.db;
  if (!db) return;
  const ctx = (await getAccountContext(db, { telegramId: String(TELEGRAM_ID) }))!;
  const account = ctx.account!;
  const wallet = ctx.wallet!;

  $("acct-name").textContent = account.type === "BUSINESS" ? `${account.businessName}` : "Personal account";
  $("acct-type").textContent = account.type === "BUSINESS" ? "Business" : "Personal";
  $("clock").textContent = `${formatDateTime(state.now, TIMEZONE)} · ${TIMEZONE}`;
  $("balance").textContent = `${formatUsdcAmount(state.balances.get(state.walletAddress) ?? BigInt(0))} USDC`;
  $("floor").textContent = wallet.balanceFloor ? `Balance floor ${formatUsdc(wallet.balanceFloor)} USDC` : "No balance floor";
  const perm = $("permission");
  perm.textContent = wallet.signerStatus === "GRANTED" ? "Permission granted" : "Permission revoked";
  perm.className = `pill ${wallet.signerStatus === "GRANTED" ? "ok" : "bad"}`;
  $("toggle-permission").textContent = wallet.signerStatus === "GRANTED" ? "Revoke permission" : "Grant permission";

  const automations = await listAutomations(db, account.id);
  const autoList = $("automations");
  autoList.replaceChildren(
    ...(automations.length
      ? automations.map(({ automation, destination }) => {
          const li = el("li", "row");
          const main = el("div", "row-main");
          main.append(el("div", "row-title", `${formatUsdc(automation.amount)} USDC → ${destination.label}`));
          const cond = automation.conditions[0];
          main.append(
            el(
              "div",
              "row-sub",
              [
                automation.schedule.frequency === "WEEKLY"
                  ? `Weekly, ${automation.schedule.dayOfWeek.toLowerCase()} ${automation.schedule.time}`
                  : automation.schedule.frequency === "MONTHLY"
                    ? `Monthly, day ${automation.schedule.dayOfMonth} ${automation.schedule.time}`
                    : automation.schedule.frequency === "DAILY"
                      ? `Daily ${automation.schedule.time}`
                      : `Once, ${automation.schedule.date} ${automation.schedule.time}`,
                cond ? `if balance ≥ ${formatUsdc(cond.amount)}` : "",
                automation.memo ? `memo ${automation.memo}` : "",
                automation.nextRunAt && automation.status === "ACTIVE" ? `next ${formatDateTime(automation.nextRunAt, automation.timezone)}` : ""
              ]
                .filter(Boolean)
                .join(" · ")
            )
          );
          li.append(main, el("span", `pill ${STATUS_CLASS[automation.status]}`, automation.status.toLowerCase()));
          return li;
        })
      : [el("li", "empty", "None yet. Try an example request on the left.")])
  );

  const destinations = await listDestinations(db, account.id);
  $("destinations").replaceChildren(
    ...destinations.map((d) => {
      const li = el("li", "row");
      const main = el("div", "row-main");
      main.append(el("div", "row-title", d.label), el("div", "row-sub mono", d.address));
      li.append(main, el("span", "pill muted", d.category.toLowerCase()));
      return li;
    })
  );

  const executions = await listExecutions(db, account.id, 20);
  $("history").replaceChildren(
    ...(executions.length
      ? executions.map(({ execution, destination }) => {
          const li = el("li", "row");
          const main = el("div", "row-main");
          main.append(
            el("div", "row-title", `${formatUsdc(execution.amount)} USDC → ${destination.label}${execution.trigger === "MANUAL" ? " (run now)" : ""}`),
            el(
              "div",
              "row-sub",
              execution.txHash ? `simulated tx ${execution.txHash.slice(0, 14)}…` : execution.errorMessage ?? execution.errorCode ?? ""
            )
          );
          li.append(main, el("span", `pill ${STATUS_CLASS[execution.status]}`, execution.status.toLowerCase()));
          return li;
        })
      : [el("li", "empty", "No payments yet. Use /run in the chat, or move the clock to the next run.")])
  );
}

// ---------- Start ----------

async function main() {
  $("chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("chat-input") as HTMLInputElement;
    const text = input.value;
    input.value = "";
    sendText(text);
  });
  $("advance").onclick = () => advanceToNextRun();
  $("fund").onclick = () => fund("100");
  $("toggle-permission").onclick = async () => {
    const ctx = (await getAccountContext(state.db!, { telegramId: String(TELEGRAM_ID) }))!;
    await setPermission(ctx.wallet!.signerStatus !== "GRANTED");
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-account]")) {
    button.onclick = async () => {
      const type = button.dataset.account as "INDIVIDUAL" | "BUSINESS";
      document.querySelectorAll("[data-account]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      await boot(type).catch(showBootError);
    };
  }

  renderAiStatus();
  const claude = window.claude;
  if (claude?.use) {
    claude
      .use("sample")
      .then((sample) => {
        state.sample = (sample as SampleFn | null) ?? null;
        state.aiMode = state.sample ? "live" : "canned";
        renderAiStatus();
      })
      .catch(() => {
        state.aiMode = "canned";
        renderAiStatus();
      });
  } else {
    state.aiMode = "canned";
    renderAiStatus();
  }

  await boot("BUSINESS").catch(showBootError);
}

function showBootError(error: unknown) {
  console.error(error);
  $("boot").hidden = false;
  $("boot-text").textContent = `The sandbox couldn't start its in-browser database: ${(error as Error).message ?? error}`;
}

main();
