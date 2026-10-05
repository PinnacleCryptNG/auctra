import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, withAuth } from "@/lib/app/http";
import { createAccount } from "@/lib/services/accounts";
import { UserFacingError } from "@/lib/services/errors";

const body = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]),
  businessName: z.string().max(120).optional(),
  timezone: z.string().min(1).max(64)
});

export const POST = withAuth(async (auth, request) => {
  if (!auth.ctx) throw new UserFacingError("NOT_LINKED", "Open Auctra from Telegram with /start to link your account.");
  const input = await readJson(request, body);
  const account = await createAccount(auth.db, { userId: auth.ctx.user.id, ...input });
  return NextResponse.json({ account: { id: account.id, type: account.type, businessName: account.businessName } });
});
