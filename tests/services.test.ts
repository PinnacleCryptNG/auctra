import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/client";
import { confirmations } from "../db/schema";
import type { FinancialIntent } from "../lib/financial-intent";
import { consumeLinkToken, createAccount, createLinkToken, getOrCreateTelegramUser } from "../lib/services/accounts";
import { activateAutomation, changeAutomationStatus, listAutomations, prepareAutomation } from "../lib/services/automations";
import { archiveDestination, findDestinationByLabel, proposeDestination } from "../lib/services/destinations";
import { createTestDb } from "./helpers/db";
import { SAVINGS_ADDRESS, VENDOR_ADDRESS, createFixture } from "./helpers/fixtures";

const NOW = new Date("2026-10-05T10:00:00Z"); // Monday

const savingsIntent: FinancialIntent = {
  action: "TRANSFER",
  asset: "USDC",
  amount: "20",
  destination: { label: "my savings wallet" },
  schedule: { frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "18:00" },
  conditions: []
};

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("accounts", () => {
  it("links a Telegram user to a Privy login with a single-use token", async () => {
    const user = await getOrCreateTelegramUser(db, { telegramId: "42", chatId: "42" });
    const token = await createLinkToken(db, user.id);

    const linked = await consumeLinkToken(db, token, "did:privy:abc");
    expect(linked.privyUserId).toBe("did:privy:abc");
    await expect(consumeLinkToken(db, token, "did:privy:abc")).rejects.toMatchObject({ code: "LINK_INVALID" });
  });

  it("rejects expired link tokens", async () => {
    const user = await getOrCreateTelegramUser(db, { telegramId: "43", chatId: "43" });
    const token = await createLinkToken(db, user.id, new Date("2020-01-01T00:00:00Z"));
    await expect(consumeLinkToken(db, token, "did:privy:x")).rejects.toMatchObject({ code: "LINK_INVALID" });
  });

  it("requires a business name for business accounts", async () => {
    const user = await getOrCreateTelegramUser(db, { telegramId: "44", chatId: "44" });
    await expect(createAccount(db, { userId: user.id, type: "BUSINESS", timezone: "UTC" })).rejects.toMatchObject({
      code: "INVALID_BUSINESS_NAME"
    });
    const account = await createAccount(db, { userId: user.id, type: "BUSINESS", businessName: " Acme Labs ", timezone: "UTC" });
    expect(account.businessName).toBe("Acme Labs");
  });
});

describe("destinations", () => {
  it("finds a saved destination by a natural label", async () => {
    const { ctx } = await createFixture(db);
    expect(await findDestinationByLabel(db, ctx.account!.id, "my savings wallet")).toMatchObject({ address: SAVINGS_ADDRESS });
    expect(await findDestinationByLabel(db, ctx.account!.id, "SAVINGS   WALLET")).not.toBeNull();
    expect(await findDestinationByLabel(db, ctx.account!.id, "rent")).toBeNull();
  });

  it("refuses duplicates, the own wallet and the token contract", async () => {
    const { ctx } = await createFixture(db);
    const base = { userId: ctx.user.id, accountId: ctx.account!.id, walletAddress: ctx.wallet!.address };

    await expect(proposeDestination(db, { ...base, label: "Savings Wallet", address: VENDOR_ADDRESS })).rejects.toMatchObject({ code: "DUPLICATE_LABEL" });
    await expect(proposeDestination(db, { ...base, label: "Other", address: SAVINGS_ADDRESS })).rejects.toMatchObject({ code: "DUPLICATE_ADDRESS" });
    await expect(proposeDestination(db, { ...base, label: "Me", address: ctx.wallet!.address })).rejects.toMatchObject({ code: "INVALID_ADDRESS" });
    await expect(
      proposeDestination(db, { ...base, label: "Token", address: "0x534b2f3A21130d7a60830c2Df862319e593943A3" })
    ).rejects.toMatchObject({ code: "INVALID_ADDRESS" });
  });

  it("archiving a destination cancels its automations and frees the name", async () => {
    const { ctx, destination } = await createFixture(db);
    const prepared = await prepareAutomation(db, ctx, savingsIntent, NOW);
    if (prepared.kind !== "confirm") throw new Error("expected confirmation");
    const automation = await activateAutomation(db, ctx, prepared.confirmationId, NOW);

    const result = await archiveDestination(db, { userId: ctx.user.id, accountId: ctx.account!.id, destinationId: destination.id });
    expect(result.cancelledAutomations).toBe(1);
    const [row] = await listAutomations(db, ctx.account!.id);
    expect(row.automation.id).toBe(automation.id);
    expect(row.automation.status).toBe("CANCELLED");

    await expect(
      proposeDestination(db, { userId: ctx.user.id, accountId: ctx.account!.id, label: "Savings wallet", address: SAVINGS_ADDRESS })
    ).resolves.toBeDefined();
  });
});

describe("automations", () => {
  it("shows an exact summary, then activates with the next run in the user's timezone", async () => {
    const { ctx } = await createFixture(db, { type: "BUSINESS" });
    const prepared = await prepareAutomation(db, ctx, { ...savingsIntent, memo: "INV-7" }, NOW);
    if (prepared.kind !== "confirm") throw new Error("expected confirmation");

    expect(prepared.summary).toContain("Send: 20 USDC");
    expect(prepared.summary).toContain(`Savings wallet (savings) → ${SAVINGS_ADDRESS}`);
    expect(prepared.summary).toContain("every Friday at 18:00 (Africa/Lagos)");
    expect(prepared.summary).toContain("Memo: INV-7");
    expect(prepared.summary).toContain("Acme Labs (business)");
    expect(prepared.summary).toContain("Monad Testnet");

    const automation = await activateAutomation(db, ctx, prepared.confirmationId, NOW);
    expect(automation.status).toBe("ACTIVE");
    expect(automation.nextRunAt?.toISOString()).toBe("2026-10-09T17:00:00.000Z");
    expect(automation.memo).toBe("INV-7");
  });

  it("confirmations are single-use and bound to their user", async () => {
    const { ctx } = await createFixture(db);
    const other = await createFixture(db);
    const prepared = await prepareAutomation(db, ctx, savingsIntent, NOW);
    if (prepared.kind !== "confirm") throw new Error("expected confirmation");

    await expect(activateAutomation(db, other.ctx, prepared.confirmationId, NOW)).rejects.toMatchObject({ code: "CONFIRMATION_INVALID" });
    await activateAutomation(db, ctx, prepared.confirmationId, NOW);
    await expect(activateAutomation(db, ctx, prepared.confirmationId, NOW)).rejects.toMatchObject({ code: "CONFIRMATION_INVALID" });
  });

  it("rejects a confirmation whose payload was altered", async () => {
    const { ctx } = await createFixture(db);
    const prepared = await prepareAutomation(db, ctx, savingsIntent, NOW);
    if (prepared.kind !== "confirm") throw new Error("expected confirmation");
    const [row] = await db.select().from(confirmations).where(eq(confirmations.id, prepared.confirmationId));
    await db.update(confirmations).set({ payload: { ...(row.payload as object), amount: "99" } }).where(eq(confirmations.id, row.id));

    await expect(activateAutomation(db, ctx, prepared.confirmationId, NOW)).rejects.toMatchObject({ code: "CONFIRMATION_TAMPERED" });
  });

  it("asks to save an unknown literal address instead of using it", async () => {
    const { ctx } = await createFixture(db);
    const result = await prepareAutomation(db, ctx, { ...savingsIntent, destination: { address: VENDOR_ADDRESS } }, NOW);
    expect(result).toEqual({ kind: "needs_destination", address: VENDOR_ADDRESS });
  });

  it("rejects unknown labels, amounts above the cap, and past one-time dates", async () => {
    const { ctx } = await createFixture(db);
    await expect(prepareAutomation(db, ctx, { ...savingsIntent, destination: { label: "rent" } }, NOW)).rejects.toMatchObject({ code: "UNKNOWN_DESTINATION" });
    await expect(prepareAutomation(db, ctx, { ...savingsIntent, amount: "100.01" }, NOW)).rejects.toMatchObject({ code: "AMOUNT_ABOVE_CAP" });
    await expect(
      prepareAutomation(db, ctx, { ...savingsIntent, schedule: { frequency: "ONCE", date: "2026-01-01", time: "09:00" } }, NOW)
    ).rejects.toMatchObject({ code: "SCHEDULE_IN_PAST" });
  });

  it("pauses, resumes from now, and cancels", async () => {
    const { ctx } = await createFixture(db);
    const prepared = await prepareAutomation(db, ctx, savingsIntent, NOW);
    if (prepared.kind !== "confirm") throw new Error("expected confirmation");
    const automation = await activateAutomation(db, ctx, prepared.confirmationId, NOW);
    const ids = { userId: ctx.user.id, accountId: ctx.account!.id, automationId: automation.id };

    expect((await changeAutomationStatus(db, { ...ids, action: "pause" }, NOW)).status).toBe("PAUSED");
    await expect(changeAutomationStatus(db, { ...ids, action: "pause" }, NOW)).rejects.toMatchObject({ code: "INVALID_STATUS" });

    const resumed = await changeAutomationStatus(db, { ...ids, action: "resume" }, new Date("2026-10-20T00:00:00Z"));
    expect(resumed.nextRunAt?.toISOString()).toBe("2026-10-23T17:00:00.000Z");

    const cancelled = await changeAutomationStatus(db, { ...ids, action: "cancel" }, NOW);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.nextRunAt).toBeNull();
    await expect(changeAutomationStatus(db, { ...ids, action: "resume" }, NOW)).rejects.toMatchObject({ code: "INVALID_STATUS" });
  });
});
