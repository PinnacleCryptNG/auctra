import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/client";
import { automations, executions, wallets } from "../db/schema";
import type { FinancialIntent } from "../lib/financial-intent";
import { setSignerStatus, updateSettings } from "../lib/services/accounts";
import { activateAutomation, changeAutomationStatus, prepareAutomation } from "../lib/services/automations";
import { reconcileExecutions, runDueAutomations, runNow, type ExecutionDeps } from "../lib/services/executions";
import { createTestDb } from "./helpers/db";
import { createFixture, VENDOR_ADDRESS } from "./helpers/fixtures";
import { confirmDestination, proposeDestination } from "../lib/services/destinations";

const CREATED = new Date("2026-10-05T10:00:00Z"); // Monday
const FRIDAY_RUN = new Date("2026-10-09T17:00:00Z"); // Friday 18:00 Lagos
const USDC = (n: number) => BigInt(Math.round(n * 1_000_000));

const intent: FinancialIntent = {
  action: "TRANSFER",
  asset: "USDC",
  amount: "20",
  destination: { label: "Savings wallet" },
  schedule: { frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "18:00" },
  conditions: []
};

function makeDeps(overrides: Partial<ExecutionDeps> & { balance?: bigint } = {}) {
  let hashes = 0;
  const deps = {
    signer: { sendTransaction: vi.fn(async () => ({ hash: `0x${(++hashes).toString(16).padStart(64, "0")}` as `0x${string}` })) },
    readUsdcBalance: vi.fn(async () => overrides.balance ?? USDC(500)),
    waitForReceipt: vi.fn(async () => "success" as const),
    isProviderRejection: vi.fn(() => false),
    notify: vi.fn(async () => undefined),
    ...overrides
  } satisfies ExecutionDeps;
  return deps;
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

async function setup(automationIntent: FinancialIntent = intent, options: Parameters<typeof createFixture>[1] = {}) {
  const fixture = await createFixture(db, options);
  const prepared = await prepareAutomation(db, fixture.ctx, automationIntent, CREATED);
  if (prepared.kind !== "confirm") throw new Error("expected confirmation");
  const automation = await activateAutomation(db, fixture.ctx, prepared.confirmationId, CREATED);
  return { ...fixture, automation };
}

const allExecutions = () => db.select().from(executions);
const reload = async (id: string) => (await db.select().from(automations).where(eq(automations.id, id)))[0];

describe("scheduler", () => {
  it("does nothing before the automation is due", async () => {
    await setup();
    const deps = makeDeps();
    expect(await runDueAutomations(db, deps, new Date("2026-10-09T16:59:00Z"))).toEqual([]);
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
  });

  it("executes a due automation exactly once and advances the schedule", async () => {
    const { automation } = await setup();
    const deps = makeDeps();

    const [result] = await runDueAutomations(db, deps, FRIDAY_RUN);
    expect(result.status).toBe("CONFIRMED");
    expect(result.executionKey).toBe(`${automation.id}:2026-10-09T17:00:00.000Z`);
    expect(deps.signer.sendTransaction).toHaveBeenCalledTimes(1);
    const [, , idempotencyKey] = vi.mocked(deps.signer.sendTransaction).mock.calls[0];
    expect(idempotencyKey).toBe(result.executionKey);

    // A second pass at the same instant finds nothing due.
    expect(await runDueAutomations(db, deps, FRIDAY_RUN)).toEqual([]);
    expect(deps.signer.sendTransaction).toHaveBeenCalledTimes(1);

    const updated = await reload(automation.id);
    expect(updated.nextRunAt?.toISOString()).toBe("2026-10-16T17:00:00.000Z");
    expect(updated.executionCount).toBe(1);
    const [execution] = await allExecutions();
    expect(execution.txHash).toMatch(/^0x/);
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });

  it("never double-executes when two scheduler passes race", async () => {
    await setup();
    const deps = makeDeps();
    const results = await Promise.all([runDueAutomations(db, deps, FRIDAY_RUN), runDueAutomations(db, deps, FRIDAY_RUN)]);
    expect(deps.signer.sendTransaction).toHaveBeenCalledTimes(1);
    expect(results.flat().filter((r) => r.status === "CONFIRMED")).toHaveLength(1);
    expect(await allExecutions()).toHaveLength(1);
  });

  it("runs only the latest missed occurrence", async () => {
    const { automation } = await setup();
    const deps = makeDeps();
    const [result] = await runDueAutomations(db, deps, new Date("2026-10-23T18:00:00Z"));
    expect(result.executionKey).toBe(`${automation.id}:2026-10-23T17:00:00.000Z`);
    expect(deps.signer.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it("skips an occurrence missed by more than 24 hours without sending", async () => {
    const { automation } = await setup();
    const deps = makeDeps();
    const [result] = await runDueAutomations(db, deps, new Date("2026-10-11T17:00:01Z"));
    expect(result.status).toBe("SKIPPED");
    expect((await allExecutions())[0].errorCode).toBe("MISSED_WINDOW");
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
    expect((await reload(automation.id)).nextRunAt?.toISOString()).toBe("2026-10-16T17:00:00.000Z");
  });

  it("never runs paused or cancelled automations", async () => {
    const { ctx, automation } = await setup();
    const deps = makeDeps();
    const ids = { userId: ctx.user.id, accountId: ctx.account!.id, automationId: automation.id };

    await changeAutomationStatus(db, { ...ids, action: "pause" }, CREATED);
    expect(await runDueAutomations(db, deps, FRIDAY_RUN)).toEqual([]);
    await changeAutomationStatus(db, { ...ids, action: "cancel" }, CREATED);
    expect(await runDueAutomations(db, deps, FRIDAY_RUN)).toEqual([]);
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
  });

  it("completes a one-time automation after it runs", async () => {
    const { automation } = await setup({ ...intent, schedule: { frequency: "ONCE", date: "2026-10-06", time: "09:00" } });
    await runDueAutomations(db, makeDeps(), new Date("2026-10-06T08:00:00Z"));
    const updated = await reload(automation.id);
    expect(updated.status).toBe("COMPLETED");
    expect(updated.nextRunAt).toBeNull();
  });
});

describe("preflight (fail closed)", () => {
  async function runWith(deps: ReturnType<typeof makeDeps>) {
    const [result] = await runDueAutomations(db, deps, FRIDAY_RUN);
    const [execution] = await allExecutions();
    return { result, execution };
  }

  it("skips on insufficient balance and never partially executes", async () => {
    await setup();
    const deps = makeDeps({ balance: USDC(19.99) });
    const { execution } = await runWith(deps);
    expect(execution.status).toBe("SKIPPED");
    expect(execution.errorCode).toBe("INSUFFICIENT_BALANCE");
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });

  it("skips when the MIN_BALANCE condition is not met", async () => {
    await setup({ ...intent, conditions: [{ type: "MIN_BALANCE", amount: "300" }] });
    const deps = makeDeps({ balance: USDC(299) });
    const { execution } = await runWith(deps);
    expect(execution.errorCode).toBe("CONDITION_NOT_MET");
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
  });

  it("skips when the transfer would break the balance floor", async () => {
    const { ctx } = await setup();
    await updateSettings(db, { userId: ctx.user.id, accountId: ctx.account!.id, balanceFloor: "490" });
    const deps = makeDeps({ balance: USDC(500) });
    const { execution } = await runWith(deps);
    expect(execution.errorCode).toBe("BALANCE_FLOOR");
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects when the signer permission was revoked", async () => {
    const { ctx } = await setup();
    await setSignerStatus(db, { accountId: ctx.account!.id, userId: ctx.user.id, status: "REVOKED" });
    const deps = makeDeps();
    const { execution } = await runWith(deps);
    expect(execution.status).toBe("REJECTED");
    expect(execution.errorCode).toBe("MISSING_PERMISSION");
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects when permission was never granted, and never calls the signer", async () => {
    await setup(intent, { signer: false });
    const deps = makeDeps();
    const { execution } = await runWith(deps);
    expect(execution.status).toBe("REJECTED");
    expect(execution.errorCode).toBe("MISSING_PERMISSION");
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
  });

  it("Run now is also refused without permission", async () => {
    const { ctx, automation } = await setup(intent, { signer: false });
    const deps = makeDeps();
    const execution = await runNow(db, deps, { accountId: ctx.account!.id, automationId: automation.id, requestId: "request-perm-1", userId: ctx.user.id }, CREATED);
    expect(execution).toMatchObject({ status: "REJECTED", errorCode: "MISSING_PERMISSION" });
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects when the verified permission is stale (destinations changed since approval)", async () => {
    const { ctx } = await setup();
    const proposal = await proposeDestination(db, {
      userId: ctx.user.id,
      accountId: ctx.account!.id,
      walletAddress: ctx.wallet!.address,
      label: "Vendor",
      address: VENDOR_ADDRESS,
      category: "VENDOR"
    });
    await confirmDestination(db, { confirmationId: proposal.confirmationId, userId: ctx.user.id, accountId: ctx.account!.id });
    const deps = makeDeps();
    const { execution } = await runWith(deps);
    expect(execution).toMatchObject({ status: "REJECTED", errorCode: "PERMISSION_STALE" });
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects a legacy grant that has no verified policy fingerprint", async () => {
    const { ctx } = await setup();
    await db.update(wallets).set({ policyFingerprint: null }).where(eq(wallets.accountId, ctx.account!.id));
    const deps = makeDeps();
    const { execution } = await runWith(deps);
    expect(execution).toMatchObject({ status: "REJECTED", errorCode: "PERMISSION_STALE" });
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
  });

  it("skips when the 24h daily cap would be exceeded", async () => {
    const { ctx, automation } = await setup({ ...intent, amount: "100" });
    const deps = makeDeps();
    const ids = { accountId: ctx.account!.id, automationId: automation.id, userId: ctx.user.id };
    await runNow(db, deps, { ...ids, requestId: "request-0001" }, CREATED);
    await runNow(db, deps, { ...ids, requestId: "request-0002" }, CREATED);
    const third = await runNow(db, deps, { ...ids, requestId: "request-0003" }, CREATED);
    expect(third.status).toBe("SKIPPED");
    expect(third.errorCode).toBe("DAILY_CAP");
    expect(deps.signer.sendTransaction).toHaveBeenCalledTimes(2);
  });

  it("records a provider refusal (e.g. Privy policy) as REJECTED", async () => {
    await setup();
    const deps = makeDeps({
      signer: { sendTransaction: vi.fn(async () => { throw new Error("policy violation"); }) },
      isProviderRejection: vi.fn(() => true)
    });
    const { execution } = await runWith(deps);
    expect(execution.status).toBe("REJECTED");
    expect(execution.errorCode).toBe("PROVIDER_REJECTED");
  });

  it("skips (never unknown) when the balance cannot be read", async () => {
    await setup();
    const deps = makeDeps({ readUsdcBalance: vi.fn(async () => { throw new Error("rpc down"); }) });
    const { execution } = await runWith(deps);
    expect(execution.status).toBe("SKIPPED");
    expect(execution.errorCode).toBe("PREFLIGHT_ERROR");
    expect(deps.signer.sendTransaction).not.toHaveBeenCalled();
  });
});

describe("uncertain outcomes", () => {
  it("leaves a timed-out submission PENDING, then marks it UNKNOWN without re-sending", async () => {
    await setup();
    const deps = makeDeps({ signer: { sendTransaction: vi.fn(async () => { throw new Error("socket hang up"); }) } });
    await runDueAutomations(db, deps, FRIDAY_RUN);
    expect((await allExecutions())[0].status).toBe("PENDING");

    await reconcileExecutions(db, deps, new Date(Date.now() + 10 * 60 * 1000));
    const [execution] = await allExecutions();
    expect(execution.status).toBe("UNKNOWN");
    expect(deps.signer.sendTransaction).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });

  it("confirms a SUBMITTED execution later by its tx hash", async () => {
    const { automation } = await setup();
    const deps = makeDeps({ waitForReceipt: vi.fn(async () => null) });
    await runDueAutomations(db, deps, FRIDAY_RUN);
    expect((await allExecutions())[0].status).toBe("SUBMITTED");

    vi.mocked(deps.waitForReceipt).mockResolvedValue("success");
    await reconcileExecutions(db, deps, FRIDAY_RUN);
    expect((await allExecutions())[0].status).toBe("CONFIRMED");
    expect((await reload(automation.id)).executionCount).toBe(1);
    expect(deps.signer.sendTransaction).toHaveBeenCalledTimes(1);
  });

  it("marks a reverted transaction FAILED", async () => {
    await setup();
    const deps = makeDeps({ waitForReceipt: vi.fn(async () => "reverted" as const) });
    await runDueAutomations(db, deps, FRIDAY_RUN);
    expect((await allExecutions())[0]).toMatchObject({ status: "FAILED", errorCode: "TX_REVERTED" });
  });
});

describe("run now", () => {
  it("executes immediately without moving the scheduled run, and is idempotent per request", async () => {
    const { ctx, automation } = await setup();
    const deps = makeDeps();
    const input = { accountId: ctx.account!.id, automationId: automation.id, requestId: "demo-request-1", userId: ctx.user.id };

    const first = await runNow(db, deps, input, CREATED);
    const again = await runNow(db, deps, input, CREATED);
    expect(first.status).toBe("CONFIRMED");
    expect(again.id).toBe(first.id);
    expect(first.executionKey).toBe(`${automation.id}:manual:demo-request-1`);
    expect(deps.signer.sendTransaction).toHaveBeenCalledTimes(1);
    expect((await reload(automation.id)).nextRunAt?.toISOString()).toBe(FRIDAY_RUN.toISOString());
  });

  it("refuses another account's automation", async () => {
    const { automation } = await setup();
    const other = await createFixture(db);
    await expect(
      runNow(db, makeDeps(), { accountId: other.ctx.account!.id, automationId: automation.id, requestId: "request-x1", userId: other.ctx.user.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("wallet guard", () => {
  it("database refuses a wallet on another chain", async () => {
    const { ctx } = await setup();
    await expect(db.update(wallets).set({ chainId: 1 }).where(eq(wallets.id, ctx.wallet!.id))).rejects.toThrow();
  });
});
