import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Db } from "../../db/client";
import { accounts, linkTokens, users, wallets } from "../../db/schema";
import { isValidTimezone } from "../schedule";
import { validateWalletMetadata } from "../wallet/metadata";
import { recordAudit } from "./audit";
import { UserFacingError } from "./errors";
import { randomToken, sha256 } from "./hash";

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type AccountContext = { user: User; account: Account | null; wallet: Wallet | null };

const LINK_TOKEN_TTL_MS = 30 * 60 * 1000;

export async function getOrCreateTelegramUser(db: Db, telegram: { telegramId: string; chatId: string }): Promise<User> {
  const [existing] = await db.select().from(users).where(eq(users.telegramId, telegram.telegramId));
  if (existing) {
    if (existing.telegramChatId !== telegram.chatId) {
      const [updated] = await db
        .update(users)
        .set({ telegramChatId: telegram.chatId })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({ telegramId: telegram.telegramId, telegramChatId: telegram.chatId })
    .onConflictDoNothing({ target: users.telegramId })
    .returning();
  if (created) {
    await recordAudit(db, { userId: created.id, eventType: "USER_CREATED", metadata: { via: "telegram" } });
    return created;
  }
  // Lost a race with a concurrent insert.
  const [raced] = await db.select().from(users).where(eq(users.telegramId, telegram.telegramId));
  return raced;
}

/** One-time token for the Telegram → web onboarding link (PRD §6 step 2). */
export async function createLinkToken(db: Db, userId: string, now = new Date()): Promise<string> {
  const token = randomToken();
  await db.insert(linkTokens).values({
    tokenHash: sha256(token),
    userId,
    expiresAt: new Date(now.getTime() + LINK_TOKEN_TTL_MS)
  });
  return token;
}

/** Links the Telegram user behind `token` to a Privy login. Single use. */
export async function consumeLinkToken(db: Db, token: string, privyUserId: string, now = new Date()): Promise<User> {
  const [link] = await db
    .update(linkTokens)
    .set({ usedAt: now })
    .where(and(eq(linkTokens.tokenHash, sha256(token)), isNull(linkTokens.usedAt), gt(linkTokens.expiresAt, now)))
    .returning();
  if (!link) throw new UserFacingError("LINK_INVALID", "This link has expired or was already used. Send /start to get a new one.");

  const [alreadyLinked] = await db.select().from(users).where(eq(users.privyUserId, privyUserId));
  if (alreadyLinked && alreadyLinked.id !== link.userId) {
    return attachTelegramToPrivyUser(db, { privyUser: alreadyLinked, telegramUserId: link.userId });
  }

  const [user] = await db
    .update(users)
    .set({ privyUserId })
    .where(and(eq(users.id, link.userId), or(isNull(users.privyUserId), eq(users.privyUserId, privyUserId))))
    .returning();
  if (!user) throw new UserFacingError("LINK_CONFLICT", "This Telegram account is already linked to a different login.");

  await recordAudit(db, { userId: user.id, eventType: "USER_LINKED", metadata: { privyUserId } });
  return user;
}

/**
 * Someone who signed in on the web first and later sent /start in Telegram:
 * move the Telegram identity onto their existing Auctra user. Only allowed
 * when that user has no Telegram link yet and the Telegram-only record has
 * no account of its own; anything else is a genuine conflict.
 */
async function attachTelegramToPrivyUser(db: Db, input: { privyUser: User; telegramUserId: string }): Promise<User> {
  const [telegramUser] = await db.select().from(users).where(eq(users.id, input.telegramUserId));
  const [telegramAccount] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.ownerUserId, input.telegramUserId));
  if (!telegramUser?.telegramId || input.privyUser.telegramId || telegramAccount) {
    throw new UserFacingError("LINK_CONFLICT", "This login is already linked to a different Telegram account.");
  }
  // telegram_id is unique: release it from the Telegram-only record first.
  await db.update(users).set({ telegramId: null, telegramChatId: null }).where(eq(users.id, telegramUser.id));
  const [user] = await db
    .update(users)
    .set({ telegramId: telegramUser.telegramId, telegramChatId: telegramUser.telegramChatId })
    .where(and(eq(users.id, input.privyUser.id), isNull(users.telegramId)))
    .returning();
  if (!user) throw new UserFacingError("LINK_CONFLICT", "This login is already linked to a different Telegram account.");
  await recordAudit(db, { userId: user.id, eventType: "USER_LINKED", metadata: { privyUserId: user.privyUserId, mergedFromUserId: telegramUser.id } });
  return user;
}

/**
 * The Auctra user for a verified Privy login (PRD §6 step 2). Created on
 * first sign-in; idempotent. Stores the Privy user ID only, no credentials.
 */
export async function getOrCreatePrivyUser(db: Db, privyUserId: string): Promise<User> {
  if (!/^[\w:.-]{1,128}$/.test(privyUserId)) throw new UserFacingError("INVALID_USER", "This sign-in couldn't be verified.");
  const [existing] = await db.select().from(users).where(eq(users.privyUserId, privyUserId));
  if (existing) return existing;

  const [created] = await db.insert(users).values({ privyUserId }).onConflictDoNothing({ target: users.privyUserId }).returning();
  if (created) {
    await recordAudit(db, { userId: created.id, eventType: "USER_CREATED", metadata: { via: "privy" } });
    return created;
  }
  const [raced] = await db.select().from(users).where(eq(users.privyUserId, privyUserId));
  return raced;
}

export async function getAccountContext(db: Db, where: { userId: string } | { privyUserId: string } | { telegramId: string }): Promise<AccountContext | null> {
  const condition =
    "userId" in where
      ? eq(users.id, where.userId)
      : "privyUserId" in where
        ? eq(users.privyUserId, where.privyUserId)
        : eq(users.telegramId, where.telegramId);

  const [row] = await db
    .select({ user: users, account: accounts, wallet: wallets })
    .from(users)
    .leftJoin(accounts, eq(accounts.ownerUserId, users.id))
    .leftJoin(wallets, eq(wallets.accountId, accounts.id))
    .where(condition);

  return row ?? null;
}

export async function createAccount(
  db: Db,
  input: { userId: string; type: "INDIVIDUAL" | "BUSINESS"; businessName?: string; timezone: string }
): Promise<Account> {
  if (!isValidTimezone(input.timezone)) throw new UserFacingError("INVALID_TIMEZONE", `Unknown timezone: ${input.timezone}`);

  const businessName = input.type === "BUSINESS" ? input.businessName?.trim() : undefined;
  if (input.type === "BUSINESS" && (!businessName || businessName.length > 120)) {
    throw new UserFacingError("INVALID_BUSINESS_NAME", "A business account needs a business name (up to 120 characters).");
  }

  const [account] = await db
    .insert(accounts)
    .values({ ownerUserId: input.userId, type: input.type, businessName: businessName ?? null })
    .onConflictDoNothing({ target: accounts.ownerUserId })
    .returning();
  if (!account) throw new UserFacingError("ACCOUNT_EXISTS", "You already have an Auctra account.");

  await db.update(users).set({ timezone: input.timezone }).where(eq(users.id, input.userId));
  await recordAudit(db, {
    accountId: account.id,
    userId: input.userId,
    eventType: "ACCOUNT_CREATED",
    metadata: { type: account.type, businessName: account.businessName }
  });
  return account;
}

export async function updateSettings(
  db: Db,
  input: { userId: string; accountId: string; timezone?: string; balanceFloor?: string | null }
) {
  if (input.timezone !== undefined) {
    if (!isValidTimezone(input.timezone)) throw new UserFacingError("INVALID_TIMEZONE", `Unknown timezone: ${input.timezone}`);
    await db.update(users).set({ timezone: input.timezone }).where(eq(users.id, input.userId));
  }
  if (input.balanceFloor !== undefined) {
    if (input.balanceFloor !== null && !/^\d+(\.\d{1,6})?$/.test(input.balanceFloor)) {
      throw new UserFacingError("INVALID_AMOUNT", "The balance floor must be a USDC amount with at most 6 decimals.");
    }
    await db.update(wallets).set({ balanceFloor: input.balanceFloor }).where(eq(wallets.accountId, input.accountId));
  }
  await recordAudit(db, {
    accountId: input.accountId,
    userId: input.userId,
    eventType: "SETTINGS_UPDATED",
    metadata: { timezone: input.timezone, balanceFloor: input.balanceFloor }
  });
}

export async function registerWallet(
  db: Db,
  input: { accountId: string; userId: string; privyWalletId: string; address: string; chainId: number }
): Promise<Wallet> {
  // Monad Testnet only; safe metadata only (lib/wallet/metadata.ts).
  const metadata = validateWalletMetadata(input);

  const [existing] = await db.select().from(wallets).where(eq(wallets.accountId, input.accountId));
  if (existing) {
    if (existing.privyWalletId !== metadata.privyWalletId) {
      throw new UserFacingError("WALLET_EXISTS", "This account already has an execution wallet.");
    }
    return existing;
  }

  const [wallet] = await db
    .insert(wallets)
    .values({
      accountId: input.accountId,
      privyWalletId: metadata.privyWalletId,
      address: metadata.address,
      chainId: metadata.chainId
    })
    .returning();
  await recordAudit(db, {
    accountId: input.accountId,
    userId: input.userId,
    eventType: "WALLET_REGISTERED",
    metadata: { address: wallet.address, privyWalletId: wallet.privyWalletId }
  });
  return wallet;
}

export async function setSignerStatus(
  db: Db,
  input:
    | { accountId: string; userId: string; status: "GRANTED"; privyPolicyId: string; policyFingerprint: string }
    | { accountId: string; userId: string; status: "REVOKED" }
) {
  // GRANTED is only recorded after verifyWalletPermission() checked Privy's own
  // records (app/api/onboarding/signer). REVOKED is always safe to record.
  const values =
    input.status === "GRANTED"
      ? { signerStatus: input.status, privyPolicyId: input.privyPolicyId, policyFingerprint: input.policyFingerprint }
      : { signerStatus: input.status, policyFingerprint: null };
  const [wallet] = await db.update(wallets).set(values).where(eq(wallets.accountId, input.accountId)).returning();
  if (!wallet) throw new UserFacingError("NO_WALLET", "Set up your wallet first.");

  await recordAudit(db, {
    accountId: input.accountId,
    userId: input.userId,
    eventType: input.status === "GRANTED" ? "SIGNER_GRANTED" : "SIGNER_REVOKED",
    metadata: input.status === "GRANTED" ? { privyPolicyId: input.privyPolicyId, policyFingerprint: input.policyFingerprint } : {}
  });
  return wallet;
}

export function accountDisplayName(account: Account) {
  return account.type === "BUSINESS" ? `${account.businessName} (business)` : "Personal account";
}
