import type { Db } from "../../db/client";
import { getAccountContext, createAccount, getOrCreateTelegramUser, registerWallet, setSignerStatus } from "../../lib/services/accounts";
import { confirmDestination, proposeDestination } from "../../lib/services/destinations";
import { currentPolicyLimits } from "../../lib/services/permission";
import { expectedPolicyFingerprint } from "../../lib/wallet/policy";

export const WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";
export const SAVINGS_ADDRESS = "0x2222222222222222222222222222222222222222";
export const VENDOR_ADDRESS = "0x3333333333333333333333333333333333333333";

let counter = 0;

/** A user with an account, a registered wallet (signer granted) and one saved destination. */
export async function createFixture(
  db: Db,
  options: { type?: "INDIVIDUAL" | "BUSINESS"; timezone?: string; signer?: boolean } = {}
) {
  counter += 1;
  const user = await getOrCreateTelegramUser(db, { telegramId: String(1000 + counter), chatId: String(1000 + counter) });
  const account = await createAccount(db, {
    userId: user.id,
    type: options.type ?? "INDIVIDUAL",
    businessName: options.type === "BUSINESS" ? "Acme Labs" : undefined,
    timezone: options.timezone ?? "Africa/Lagos"
  });
  await registerWallet(db, {
    accountId: account.id,
    userId: user.id,
    privyWalletId: `privy-wallet-${counter}`,
    address: `0x${counter.toString(16).padStart(40, "a")}`,
    chainId: 10143
  });
  let ctx = (await getAccountContext(db, { userId: user.id }))!;
  const proposal = await proposeDestination(db, {
    userId: user.id,
    accountId: account.id,
    walletAddress: ctx.wallet!.address,
    label: "Savings wallet",
    address: SAVINGS_ADDRESS,
    category: "SAVINGS"
  });
  const destination = await confirmDestination(db, { confirmationId: proposal.confirmationId, userId: user.id, accountId: account.id });
  if (options.signer !== false) await grantVerifiedPermission(db, account.id, user.id);
  ctx = (await getAccountContext(db, { userId: user.id }))!;
  return { ctx, destination };
}

/**
 * Test stand-in for a grant that app/api/onboarding/signer verified against
 * Privy: records GRANTED with the fingerprint of the account's current limits.
 */
export async function grantVerifiedPermission(db: Db, accountId: string, userId: string, policyId = "policy-1") {
  const limits = await currentPolicyLimits(db, accountId);
  if (!limits) throw new Error("grantVerifiedPermission needs at least one destination");
  await setSignerStatus(db, { accountId, userId, status: "GRANTED", privyPolicyId: policyId, policyFingerprint: expectedPolicyFingerprint(limits) });
}
