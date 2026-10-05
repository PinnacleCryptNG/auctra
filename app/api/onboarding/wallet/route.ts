import { NextResponse } from "next/server";
import { withAuth } from "@/lib/app/http";
import { getPrivy } from "@/lib/app/runtime";
import { registerWallet } from "@/lib/services/accounts";
import { UserFacingError } from "@/lib/services/errors";

// The wallet is looked up server-side from Privy by the authenticated user,
// so the browser can't register someone else's wallet.
export const POST = withAuth(async (auth) => {
  if (!auth.ctx?.account) throw new UserFacingError("NO_ACCOUNT", "Create your account first.");

  const found = [];
  for await (const wallet of getPrivy().client.wallets().list({ user_id: auth.privyUserId, chain_type: "ethereum" })) {
    found.push(wallet);
  }
  const wallet = found.find((w) => !w.archived_at);
  if (!wallet) throw new UserFacingError("NO_WALLET", "Your Privy wallet isn't ready yet. Refresh and try again.");

  const saved = await registerWallet(auth.db, {
    accountId: auth.ctx.account.id,
    userId: auth.ctx.user.id,
    privyWalletId: wallet.id,
    address: wallet.address
  });
  return NextResponse.json({ wallet: { address: saved.address } });
});
