import { NextResponse } from "next/server";
import { requireReady, withAuth } from "@/lib/app/http";
import { syncTransferPolicy } from "@/lib/app/runtime";
import { archiveDestination, listDestinations } from "@/lib/services/destinations";

export const DELETE = withAuth<{ id: string }>(async (auth, _request, { id }) => {
  const ctx = requireReady(auth);
  const result = await archiveDestination(auth.db, { userId: ctx.user.id, accountId: ctx.account.id, destinationId: id });
  // Keep the Privy allowlist in step. A policy can't be empty, so with no
  // destinations left the cancelled automations and app checks still block sends.
  if (ctx.wallet.privyPolicyId && (await listDestinations(auth.db, ctx.account.id)).length > 0) {
    await syncTransferPolicy(auth.db, ctx.account.id);
  }
  return NextResponse.json(result);
});
