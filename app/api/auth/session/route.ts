import { NextResponse } from "next/server";
import { withAuth } from "@/lib/app/http";
import { getAccountContext, getOrCreatePrivyUser } from "@/lib/services/accounts";

// Called right after Privy sign-in: makes sure the verified Privy user has an
// Auctra user record (PRD §6 step 2). Idempotent. Stores the Privy user ID only.
export const POST = withAuth(async (auth) => {
  const user = auth.ctx?.user ?? (await getOrCreatePrivyUser(auth.db, auth.privyUserId));
  const ctx = await getAccountContext(auth.db, { userId: user.id });
  return NextResponse.json({ linked: true, hasAccount: Boolean(ctx?.account), hasWallet: Boolean(ctx?.wallet) });
});
