import { NextResponse } from "next/server";
import { withAuth } from "@/lib/app/http";
import { getPrivyClient } from "@/lib/app/runtime";
import { ConfigurationError } from "@/lib/config";
import { assertTestnetEnvironment, MONAD_TESTNET_CHAIN_ID } from "@/lib/network";
import { registerWallet } from "@/lib/services/accounts";
import { UserFacingError } from "@/lib/services/errors";
import { selectEmbeddedWallet, type PrivyWalletSummary } from "@/lib/wallet/metadata";

// Links the signed-in user's Privy embedded wallet to their Auctra account.
// The wallet is looked up server-side from Privy by the verified user ID, so
// the browser can't register someone else's wallet. Only safe metadata
// (wallet ID, address, chain ID) is stored.
export const POST = withAuth(async (auth) => {
  if (!auth.ctx) throw new UserFacingError("NOT_LINKED", "Sign in again to continue setup.");
  if (!auth.ctx.account) throw new UserFacingError("NO_ACCOUNT", "Create your account first.");

  try {
    assertTestnetEnvironment();
  } catch {
    throw new ConfigurationError(["AUCTRA_NETWORK", "MONAD_CHAIN_ID"]);
  }

  const found: PrivyWalletSummary[] = [];
  for await (const wallet of getPrivyClient().wallets().list({ user_id: auth.privyUserId, chain_type: "ethereum" })) {
    found.push(wallet);
  }
  const wallet = selectEmbeddedWallet(found);
  if (!wallet) {
    throw new UserFacingError("WALLET_NOT_READY", "Your Auctra Wallet isn't ready yet. Wait a moment, then try again.");
  }

  const saved = await registerWallet(auth.db, {
    accountId: auth.ctx.account.id,
    userId: auth.ctx.user.id,
    privyWalletId: wallet.id,
    address: wallet.address,
    chainId: MONAD_TESTNET_CHAIN_ID
  });
  return NextResponse.json({ wallet: { address: saved.address, chainId: saved.chainId } });
});
