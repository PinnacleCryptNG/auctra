import { describe, expect, it } from "vitest";
import { accounts, users, wallets } from "../db/schema";
import { createTestDb } from "./helpers/db";

describe("database constraints", () => {
  it("requires a business name only for business accounts", async () => {
    const db = await createTestDb();
    const [user] = await db.insert(users).values({ telegramId: "1" }).returning();

    await expect(db.insert(accounts).values({ ownerUserId: user.id, type: "BUSINESS" })).rejects.toThrow();
    await expect(
      db.insert(accounts).values({ ownerUserId: user.id, type: "INDIVIDUAL", businessName: "Acme" })
    ).rejects.toThrow();
    await expect(
      db.insert(accounts).values({ ownerUserId: user.id, type: "BUSINESS", businessName: "Acme" })
    ).resolves.toBeDefined();
  });

  it("refuses wallets on any chain other than Monad Testnet", async () => {
    const db = await createTestDb();
    const [user] = await db.insert(users).values({ telegramId: "2" }).returning();
    const [account] = await db.insert(accounts).values({ ownerUserId: user.id, type: "INDIVIDUAL" }).returning();

    await expect(
      db.insert(wallets).values({ accountId: account.id, privyWalletId: "w", address: "0xabc", chainId: 1 })
    ).rejects.toThrow();
  });
});
