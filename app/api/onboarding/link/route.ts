import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, withAuth } from "@/lib/app/http";
import { consumeLinkToken, getAccountContext } from "@/lib/services/accounts";

// PRD §6 step 2: link the Telegram user (from the /start token) to this Privy login.
export const POST = withAuth(async (auth, request) => {
  const { token } = await readJson(request, z.object({ token: z.string().min(16).max(128) }));
  const user = await consumeLinkToken(auth.db, token, auth.privyUserId);
  const ctx = await getAccountContext(auth.db, { userId: user.id });
  return NextResponse.json({ linked: true, hasAccount: Boolean(ctx?.account), hasWallet: Boolean(ctx?.wallet) });
});
