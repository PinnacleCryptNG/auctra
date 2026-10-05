import type { Db } from "../../db/client";
import { getAccountContext, createAccount, getOrCreateTelegramUser, registerWallet, setSignerStatus } from "../../lib/services/accounts";
import { confirmDestination, proposeDestination } from "../../lib/services/destinations";

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
    address: `0x${counter.toString(16).padStart(40, "a")}`
  });
  if (options.signer !== false) {
    await setSignerStatus(db, { accountId: account.id, userId: user.id, status: "GRANTED", privyPolicyId: "policy-1" });
  }
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
  ctx = (await getAccountContext(db, { userId: user.id }))!;
  return { ctx, destination };
}
