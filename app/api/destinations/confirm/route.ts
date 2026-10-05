import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireReady, withAuth } from "@/lib/app/http";
import { getBotDeps } from "@/lib/app/runtime";
import { confirmDestination } from "@/lib/services/destinations";

export const POST = withAuth(async (auth, request) => {
  const ctx = requireReady(auth);
  const { confirmationId } = await readJson(request, z.object({ confirmationId: z.string().uuid() }));
  const destination = await confirmDestination(auth.db, { confirmationId, userId: ctx.user.id, accountId: ctx.account.id });
  await getBotDeps(auth.db).onDestinationsChanged(ctx.account.id);
  return NextResponse.json({ destination });
});
