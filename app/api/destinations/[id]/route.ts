import { NextResponse } from "next/server";
import { requireReady, withAuth } from "@/lib/app/http";
import { archiveDestination } from "@/lib/services/destinations";

export const DELETE = withAuth<{ id: string }>(async (auth, _request, { id }) => {
  const ctx = requireReady(auth);
  const result = await archiveDestination(auth.db, { userId: ctx.user.id, accountId: ctx.account.id, destinationId: id });
  // The Privy policy is user-owned, so Auctra doesn't edit it here. Removing a
  // destination makes the permission STALE (nothing executes) until the user
  // approves a new policy for the remaining destinations.
  return NextResponse.json(result);
});
