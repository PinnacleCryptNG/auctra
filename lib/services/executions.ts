import { and, desc, eq, gt, inArray, isNotNull, lt, lte, ne, sql } from "drizzle-orm";
import type { Address, Hex } from "viem";
import type { Db } from "../../db/client";
import { accounts, automations, destinations, executions, wallets } from "../../db/schema";
import { AuctraConfig } from "../config";
import { MONAD_TESTNET_CHAIN_ID } from "../network";
import { nextOccurrence } from "../schedule";
import { parseUsdcAmount } from "../usdc";
import { ExecutionRejectedError, executeUsdcTransfer, type WalletSigner } from "../wallet/executor";
import { recordAudit } from "./audit";
import { UserFacingError } from "./errors";

// PRD §10: reserve → preflight → submit → confirm, with a unique execution key.
// Nothing here ever re-sends a transfer whose outcome is unknown.

export type Execution = typeof executions.$inferSelect;
export type ExecutionStatus = Execution["status"];

export type ExecutionNotice = {
  accountId: string;
  execution: Execution;
  automation: typeof automations.$inferSelect;
  destination: typeof destinations.$inferSelect;
};

export type ExecutionDeps = {
  signer: WalletSigner;
  readUsdcBalance: (owner: Address) => Promise<bigint>;
  /** Waits briefly for a receipt. null = not known yet (stays SUBMITTED). */
  waitForReceipt: (hash: Hex) => Promise<"success" | "reverted" | null>;
  /** True when the provider definitely refused the request, so nothing was sent. */
  isProviderRejection: (error: unknown) => boolean;
  notify: (notice: ExecutionNotice) => Promise<void>;
};

export const MISSED_WINDOW_MS = 24 * 60 * 60 * 1000;
export const STALE_PENDING_MS = 5 * 60 * 1000;
export const STALE_SUBMITTED_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const TERMINAL: ExecutionStatus[] = ["CONFIRMED", "FAILED", "SKIPPED", "REJECTED", "UNKNOWN"];

async function loadAutomation(db: Db, automationId: string) {
  const [row] = await db
    .select({ automation: automations, destination: destinations, wallet: wallets, account: accounts })
    .from(automations)
    .innerJoin(destinations, eq(destinations.id, automations.destinationId))
    .innerJoin(wallets, eq(wallets.id, automations.walletId))
    .innerJoin(accounts, eq(accounts.id, automations.accountId))
    .where(eq(automations.id, automationId));
  return row ?? null;
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadAutomation>>>;

/** Step 1: insert the PENDING row. Returns null when the key already exists. */
async function reserve(
  db: Db,
  loaded: Loaded,
  input: { executionKey: string; trigger: "SCHEDULED" | "MANUAL"; scheduledFor: Date },
  status: ExecutionStatus = "PENDING",
  error?: { code: string; message: string }
) {
  const [execution] = await db
    .insert(executions)
    .values({
      automationId: loaded.automation.id,
      accountId: loaded.account.id,
      executionKey: input.executionKey,
      trigger: input.trigger,
      scheduledFor: input.scheduledFor,
      status,
      amount: loaded.automation.amount,
      destinationAddress: loaded.destination.address,
      errorCode: error?.code,
      errorMessage: error?.message,
      finalizedAt: TERMINAL.includes(status) ? new Date() : null
    })
    .onConflictDoNothing({ target: executions.executionKey })
    .returning();
  return execution ?? null;
}

/** Moves an execution forward only from the states it may legally leave. */
async function transition(
  db: Db,
  executionId: string,
  from: ExecutionStatus[],
  to: ExecutionStatus,
  fields: Partial<Pick<Execution, "txHash" | "errorCode" | "errorMessage" | "submittedAt">> = {}
) {
  const [updated] = await db
    .update(executions)
    .set({ status: to, ...fields, ...(TERMINAL.includes(to) ? { finalizedAt: new Date() } : {}) })
    .where(and(eq(executions.id, executionId), inArray(executions.status, from)))
    .returning();
  return updated ?? null;
}

async function finalize(db: Db, deps: ExecutionDeps, loaded: Loaded, execution: Execution) {
  if (execution.status === "CONFIRMED") {
    await db
      .update(automations)
      .set({ executionCount: sql`${automations.executionCount} + 1`, updatedAt: new Date() })
      .where(eq(automations.id, loaded.automation.id));
  }
  await recordAudit(db, {
    accountId: loaded.account.id,
    eventType: `EXECUTION_${execution.status}`,
    metadata: {
      executionId: execution.id,
      automationId: loaded.automation.id,
      executionKey: execution.executionKey,
      txHash: execution.txHash,
      errorCode: execution.errorCode
    }
  });
  if (TERMINAL.includes(execution.status)) {
    await deps
      .notify({ accountId: loaded.account.id, execution, automation: loaded.automation, destination: loaded.destination })
      .catch((error) => console.error("Execution notification failed", error));
  }
  return execution;
}

async function rolling24hSpend(db: Db, accountId: string, excludeId: string, now: Date): Promise<bigint> {
  const [row] = await db
    .select({ total: sql<string | null>`sum(${executions.amount})` })
    .from(executions)
    .where(
      and(
        eq(executions.accountId, accountId),
        inArray(executions.status, ["PENDING", "SUBMITTED", "CONFIRMED", "UNKNOWN"]),
        gt(executions.createdAt, new Date(now.getTime() - DAY_MS)),
        ne(executions.id, excludeId)
      )
    );
  return row?.total ? parseUsdcAmountOrZero(row.total) : BigInt(0);
}

function parseUsdcAmountOrZero(value: string) {
  return /^0+(\.0+)?$/.test(value) ? BigInt(0) : parseUsdcAmount(value.replace(/(\.\d{6})\d+$/, "$1"));
}

type Preflight = { ok: true; balance: bigint } | { ok: false; status: "SKIPPED" | "REJECTED"; code: string; message: string };

/** Step 2: every Layer 1 check from PRD §7.3. */
async function preflight(db: Db, deps: ExecutionDeps, loaded: Loaded, execution: Execution, now: Date): Promise<Preflight> {
  const { automation, destination, wallet } = loaded;
  const reject = (code: string, message: string): Preflight => ({ ok: false, status: "REJECTED", code, message });
  const skip = (code: string, message: string): Preflight => ({ ok: false, status: "SKIPPED", code, message });

  if (automation.status !== "ACTIVE") return reject("AUTOMATION_NOT_ACTIVE", `Automation is ${automation.status.toLowerCase()}.`);
  if (destination.archivedAt || !destination.confirmedAt) return reject("INVALID_DESTINATION", "Destination is no longer saved.");
  if (wallet.chainId !== MONAD_TESTNET_CHAIN_ID) return reject("WRONG_CHAIN", "Wallet is not on Monad Testnet.");
  if (wallet.status !== "ACTIVE" || wallet.signerStatus !== "GRANTED") {
    return reject("MISSING_PERMISSION", "Auctra no longer has permission to send from this wallet.");
  }

  const units = parseUsdcAmount(automation.amount);
  const balance = await deps.readUsdcBalance(wallet.address as Address);

  for (const condition of automation.conditions) {
    if (condition.type === "MIN_BALANCE" && balance < parseUsdcAmount(condition.amount)) {
      return skip("CONDITION_NOT_MET", `Balance is below the ${condition.amount} USDC condition.`);
    }
  }
  if (balance < units) return skip("INSUFFICIENT_BALANCE", "USDC balance is below the transfer amount.");
  if (wallet.balanceFloor && balance - units < parseUsdcAmountOrZero(wallet.balanceFloor)) {
    return skip("BALANCE_FLOOR", "This transfer would take the wallet below its balance floor.");
  }

  const spent = await rolling24hSpend(db, loaded.account.id, execution.id, now);
  if (spent + units > parseUsdcAmount(AuctraConfig.dailyCapUsdc)) {
    return skip("DAILY_CAP", `This would exceed the ${AuctraConfig.dailyCapUsdc} USDC daily limit.`);
  }

  return { ok: true, balance };
}

/** Steps 2–4 for a reserved execution. */
async function processExecution(db: Db, deps: ExecutionDeps, loaded: Loaded, execution: Execution, now: Date) {
  let check: Preflight;
  try {
    check = await preflight(db, deps, loaded, execution, now);
  } catch (error) {
    // Nothing has been sent yet, so this run is definitely skipped, not unknown.
    check = { ok: false, status: "SKIPPED", code: "PREFLIGHT_ERROR", message: `Pre-transfer checks failed: ${(error as Error).message}`.slice(0, 500) };
  }
  if (!check.ok) {
    const done = await transition(db, execution.id, ["PENDING"], check.status, { errorCode: check.code, errorMessage: check.message });
    return done ? finalize(db, deps, loaded, done) : execution;
  }

  let txHash: Hex;
  try {
    ({ txHash } = await executeUsdcTransfer(
      {
        walletId: loaded.wallet.privyWalletId,
        from: loaded.wallet.address,
        to: loaded.destination.address,
        asset: loaded.automation.asset,
        amount: loaded.automation.amount,
        chainId: loaded.wallet.chainId,
        idempotencyKey: execution.executionKey
      },
      { signer: deps.signer, readUsdcBalance: async () => check.balance }
    ));
  } catch (error) {
    if (error instanceof ExecutionRejectedError || deps.isProviderRejection(error)) {
      const code = error instanceof ExecutionRejectedError ? error.code : "PROVIDER_REJECTED";
      const status = code === "INSUFFICIENT_BALANCE" ? "SKIPPED" : "REJECTED";
      const done = await transition(db, execution.id, ["PENDING"], status, { errorCode: code, errorMessage: (error as Error).message });
      return done ? finalize(db, deps, loaded, done) : execution;
    }
    // Outcome unknown (timeout, network). Stay PENDING; reconcile() marks it UNKNOWN.
    const [kept] = await db
      .update(executions)
      .set({ errorCode: "SUBMIT_ERROR", errorMessage: (error as Error).message?.slice(0, 500) })
      .where(eq(executions.id, execution.id))
      .returning();
    return kept;
  }

  const submitted = await transition(db, execution.id, ["PENDING"], "SUBMITTED", { txHash, submittedAt: new Date() });
  if (!submitted) return execution;

  const receipt = await deps.waitForReceipt(txHash).catch(() => null);
  if (!receipt) return submitted;

  const done = await transition(db, submitted.id, ["SUBMITTED"], receipt === "success" ? "CONFIRMED" : "FAILED", {
    ...(receipt === "reverted" ? { errorCode: "TX_REVERTED", errorMessage: "The transaction reverted on-chain." } : {})
  });
  return done ? finalize(db, deps, loaded, done) : submitted;
}

export function scheduledExecutionKey(automationId: string, occurrence: Date) {
  return `${automationId}:${occurrence.toISOString()}`;
}

export type SchedulerResult = { automationId: string; executionKey: string; status: ExecutionStatus | "DUPLICATE" };

/** PRD §10 scheduler pass: run each due automation's latest occurrence exactly once. */
export async function runDueAutomations(db: Db, deps: ExecutionDeps, now = new Date(), limit = 25): Promise<SchedulerResult[]> {
  const due = await db
    .select({ id: automations.id })
    .from(automations)
    .where(and(eq(automations.status, "ACTIVE"), isNotNull(automations.nextRunAt), lte(automations.nextRunAt, now)))
    .orderBy(automations.nextRunAt)
    .limit(limit);

  const results: SchedulerResult[] = [];
  for (const { id } of due) {
    try {
      const result = await runDueAutomation(db, deps, id, now);
      if (result) results.push(result);
    } catch (error) {
      console.error(`Scheduler failed for automation ${id}`, error);
      await recordAudit(db, { eventType: "SCHEDULER_ERROR", metadata: { automationId: id, message: (error as Error).message } });
    }
  }
  return results;
}

async function runDueAutomation(db: Db, deps: ExecutionDeps, id: string, now: Date): Promise<SchedulerResult | null> {
  const loaded = await loadAutomation(db, id);
  if (!loaded?.automation.nextRunAt) return null;
  const { automation } = loaded;

  // Only the most recent due occurrence runs; earlier missed ones are counted, never replayed.
  let occurrence = automation.nextRunAt!;
  let missed = 0;
  for (let next = nextOccurrence(automation.schedule, automation.timezone, occurrence); next && next <= now && missed < 10_000; ) {
    occurrence = next;
    missed += 1;
    next = nextOccurrence(automation.schedule, automation.timezone, occurrence);
  }

  const executionKey = scheduledExecutionKey(automation.id, occurrence);
  const tooOld = now.getTime() - occurrence.getTime() > MISSED_WINDOW_MS;
  const reserved = tooOld
    ? await reserve(db, loaded, { executionKey, trigger: "SCHEDULED", scheduledFor: occurrence }, "SKIPPED", {
        code: "MISSED_WINDOW",
        message: "This run was missed by more than 24 hours, so it was skipped."
      })
    : await reserve(db, loaded, { executionKey, trigger: "SCHEDULED", scheduledFor: occurrence });

  // Advance the schedule whether or not this pass won the reservation.
  const following = nextOccurrence(automation.schedule, automation.timezone, now);
  await db
    .update(automations)
    .set({
      nextRunAt: following,
      lastRunAt: reserved ? now : automation.lastRunAt,
      ...(following === null ? { status: "COMPLETED" as const } : {}),
      updatedAt: now
    })
    .where(and(eq(automations.id, automation.id), eq(automations.nextRunAt, automation.nextRunAt!)));

  if (!reserved) return { automationId: automation.id, executionKey, status: "DUPLICATE" };
  if (missed > 0) {
    await recordAudit(db, { accountId: loaded.account.id, eventType: "OCCURRENCES_MISSED", metadata: { automationId: automation.id, count: missed } });
  }

  const result = tooOld ? await finalize(db, deps, loaded, reserved) : await processExecution(db, deps, loaded, reserved, now);
  return { automationId: automation.id, executionKey, status: result.status };
}

/** Run Now (PRD §10): a separate key; does not consume or move the scheduled occurrence. */
export async function runNow(
  db: Db,
  deps: ExecutionDeps,
  input: { accountId: string; automationId: string; requestId: string; userId: string },
  now = new Date()
): Promise<Execution> {
  const loaded = await loadAutomation(db, input.automationId);
  if (!loaded || loaded.account.id !== input.accountId) throw new UserFacingError("NOT_FOUND", "Automation not found.");
  if (loaded.automation.status !== "ACTIVE") {
    throw new UserFacingError("INVALID_STATUS", `This automation is ${loaded.automation.status.toLowerCase()}.`);
  }
  if (!/^[\w-]{8,64}$/.test(input.requestId)) throw new UserFacingError("INVALID_REQUEST", "Invalid request id.");

  const executionKey = `${loaded.automation.id}:manual:${input.requestId}`;
  const reserved = await reserve(db, loaded, { executionKey, trigger: "MANUAL", scheduledFor: now });
  if (!reserved) {
    const [existing] = await db.select().from(executions).where(eq(executions.executionKey, executionKey));
    return existing;
  }
  await recordAudit(db, { accountId: input.accountId, userId: input.userId, eventType: "RUN_NOW", metadata: { automationId: loaded.automation.id, executionKey } });
  await db.update(automations).set({ lastRunAt: now }).where(eq(automations.id, loaded.automation.id));
  return processExecution(db, deps, loaded, reserved, now);
}

/**
 * Settles in-flight executions. SUBMITTED rows are confirmed by tx hash only.
 * PENDING rows that never got a hash become UNKNOWN and are never re-sent
 * automatically (Privy's idempotency window is unverified; PRD §29 Q3).
 */
export async function reconcileExecutions(db: Db, deps: ExecutionDeps, now = new Date()) {
  const stalePending = await db
    .select()
    .from(executions)
    .where(and(eq(executions.status, "PENDING"), lt(executions.createdAt, new Date(now.getTime() - STALE_PENDING_MS))));
  const submitted = await db.select().from(executions).where(eq(executions.status, "SUBMITTED"));

  const settled: Execution[] = [];
  for (const execution of stalePending) {
    const done = await transition(db, execution.id, ["PENDING"], "UNKNOWN", {
      errorCode: "OUTCOME_UNKNOWN",
      errorMessage: `Submission did not complete${execution.errorMessage ? `: ${execution.errorMessage}` : ""}. Check the wallet before retrying.`
    });
    const loaded = done && (await loadAutomation(db, done.automationId));
    if (done && loaded) settled.push(await finalize(db, deps, loaded, done));
  }

  for (const execution of submitted) {
    const receipt = await deps.waitForReceipt(execution.txHash as Hex).catch(() => null);
    let done: Execution | null = null;
    if (receipt) {
      done = await transition(db, execution.id, ["SUBMITTED"], receipt === "success" ? "CONFIRMED" : "FAILED", {
        ...(receipt === "reverted" ? { errorCode: "TX_REVERTED", errorMessage: "The transaction reverted on-chain." } : {})
      });
    } else if (execution.submittedAt && now.getTime() - execution.submittedAt.getTime() > STALE_SUBMITTED_MS) {
      done = await transition(db, execution.id, ["SUBMITTED"], "UNKNOWN", {
        errorCode: "RECEIPT_NOT_FOUND",
        errorMessage: "No receipt after an hour. Check the transaction in the explorer."
      });
    }
    const loaded = done && (await loadAutomation(db, done.automationId));
    if (done && loaded) settled.push(await finalize(db, deps, loaded, done));
  }
  return settled;
}

export async function listExecutions(db: Db, accountId: string, limit = 50) {
  return db
    .select({ execution: executions, automation: automations, destination: destinations })
    .from(executions)
    .innerJoin(automations, eq(automations.id, executions.automationId))
    .innerJoin(destinations, eq(destinations.id, automations.destinationId))
    .where(eq(executions.accountId, accountId))
    .orderBy(desc(executions.createdAt))
    .limit(limit);
}
