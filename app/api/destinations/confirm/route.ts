import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireReady, withAuth } from "@/lib/app/http";
import { confirmDestination } from "@/lib/services/destinations";

export const POST = withAuth(async (auth, request) => {
  const ctx = requireReady(auth);
  const { confirmationId } = await readJson(request, z.object({ confirmationId: z.string().uuid() }));
  const destination = await confirmDestination(auth.db, { confirmationId, userId: ctx.user.id, accountId: ctx.account.id });
  // No policy change here: a new destination makes Auctra's permission STALE until the
  // user reviews and approves a new user-owned policy (lib/services/permission.ts).
  return NextResponse.json({ destination });
});
