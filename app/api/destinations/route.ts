import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireReady, withAuth } from "@/lib/app/http";
import { DESTINATION_CATEGORIES, listDestinations, proposeDestination } from "@/lib/services/destinations";

export const GET = withAuth(async (auth) => {
  const ctx = requireReady(auth);
  return NextResponse.json({ destinations: await listDestinations(auth.db, ctx.account.id) });
});

/** Step 1 of saving: returns a confirmation; nothing is saved until POST /api/destinations/confirm. */
export const POST = withAuth(async (auth, request) => {
  const ctx = requireReady(auth);
  const input = await readJson(
    request,
    z.object({ label: z.string(), address: z.string(), category: z.enum(DESTINATION_CATEGORIES).optional() })
  );
  const result = await proposeDestination(auth.db, {
    userId: ctx.user.id,
    accountId: ctx.account.id,
    walletAddress: ctx.wallet.address,
    ...input
  });
  return NextResponse.json(result);
});
