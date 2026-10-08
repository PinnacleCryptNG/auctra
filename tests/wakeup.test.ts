// Unit tests for on-time wake-up booking (lib/scheduler/wakeup.ts). QStash is
// replaced by a fake fetch; nothing here reaches Upstash.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/client";
import type { FinancialIntent } from "../lib/financial-intent";
import { bookNextWakeUp } from "../lib/scheduler/wakeup";
import { activateAutomation, changeAutomationStatus, prepareAutomation } from "../lib/services/automations";
import { createTestDb } from "./helpers/db";
import { createFixture } from "./helpers/fixtures";

const CREATED = new Date("2026-10-05T10:00:00Z"); // Monday
const env = { QSTASH_TOKEN: "test-token", CRON_SECRET: "test-cron", NEXT_PUBLIC_APP_URL: "https://auctra.example" };

const daily = (time: string): FinancialIntent => ({
  action: "TRANSFER",
  asset: "USDC",
  amount: "1",
  destination: { label: "Savings wallet" },
  schedule: { frequency: "DAILY", time },
  conditions: []
});

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", env.NEXT_PUBLIC_APP_URL);
});

async function automate(time: string) {
  const { ctx } = await createFixture(db, { timezone: "Africa/Lagos" });
  const prepared = await prepareAutomation(db, ctx, daily(time), CREATED);
  if (prepared.kind !== "confirm") throw new Error("expected confirmation");
  return { ctx, automation: await activateAutomation(db, ctx, prepared.confirmationId, CREATED) };
}

const okFetch = () => vi.fn(async () => new Response(JSON.stringify({ messageId: "msg_1" }), { status: 201 }));

describe("bookNextWakeUp (unit, fake QStash)", () => {
  it("books one QStash call for the exact time of the soonest active automation", async () => {
    await automate("18:00");
    await automate("17:10"); // 16:10 UTC in Lagos, the soonest
    const fetchImpl = okFetch();

    const result = await bookNextWakeUp(db, { env, fetchImpl, now: CREATED });

    expect(result).toEqual({ booked: "msg_1", at: "2026-10-05T16:10:01.000Z" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://qstash.upstash.io/v2/publish/https://auctra.example/api/cron/execute");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
    expect(headers["Upstash-Method"]).toBe("GET");
    expect(headers["Upstash-Not-Before"]).toBe(String(Date.parse("2026-10-05T16:10:01Z") / 1000));
    expect(headers["Upstash-Forward-Authorization"]).toBe("Bearer test-cron");
    expect(headers["Upstash-Deduplication-Id"]).toBe(`auctra-wake-${Date.parse("2026-10-05T16:10:01Z") / 1000}`);
  });

  it("ignores paused automations", async () => {
    const { ctx, automation } = await automate("17:10");
    await automate("18:00");
    await changeAutomationStatus(db, { userId: ctx.user.id, accountId: ctx.account!.id, automationId: automation.id, action: "pause" }, CREATED);
    const result = await bookNextWakeUp(db, { env, fetchImpl: okFetch(), now: CREATED });
    expect(result).toMatchObject({ at: "2026-10-05T17:00:01.000Z" });
  });

  it("books an overdue run for right now instead of the past", async () => {
    await automate("17:10");
    const late = new Date("2026-10-05T16:30:00Z");
    expect(await bookNextWakeUp(db, { env, fetchImpl: okFetch(), now: late })).toMatchObject({ at: "2026-10-05T16:30:01.000Z" });
  });

  it("does nothing without QStash or the cron secret, or with nothing scheduled", async () => {
    const fetchImpl = okFetch();
    expect(await bookNextWakeUp(db, { env, fetchImpl, now: CREATED })).toEqual({ skipped: "NOTHING_SCHEDULED" });
    await automate("17:10");
    expect(await bookNextWakeUp(db, { env: { ...env, QSTASH_TOKEN: undefined }, fetchImpl, now: CREATED })).toEqual({ skipped: "NOT_CONFIGURED" });
    expect(await bookNextWakeUp(db, { env: { ...env, CRON_SECRET: undefined }, fetchImpl, now: CREATED })).toEqual({ skipped: "NOT_CONFIGURED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a QStash failure instead of throwing", async () => {
    await automate("17:10");
    const refused = vi.fn(async () => new Response("no", { status: 401 }));
    expect(await bookNextWakeUp(db, { env, fetchImpl: refused, now: CREATED })).toEqual({ failed: 401 });
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await bookNextWakeUp(db, { env, fetchImpl: offline, now: CREATED })).toEqual({ failed: "TypeError" });
  });
});
