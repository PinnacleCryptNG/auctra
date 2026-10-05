import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireReady, withAuth } from "@/lib/app/http";
import { updateSettings } from "@/lib/services/accounts";

const body = z.object({
  timezone: z.string().min(1).max(64).optional(),
  balanceFloor: z.string().max(32).nullable().optional()
});

export const PATCH = withAuth(async (auth, request) => {
  const ctx = requireReady(auth);
  const input = await readJson(request, body);
  await updateSettings(auth.db, { userId: ctx.user.id, accountId: ctx.account.id, ...input });
  return NextResponse.json({ ok: true });
});
