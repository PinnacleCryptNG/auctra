import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireReady, withAuth } from "@/lib/app/http";
import { changeAutomationStatus } from "@/lib/services/automations";

// Pause / resume / cancel. Editing is cancel + re-create (PRD v2.1).
export const PATCH = withAuth<{ id: string }>(async (auth, request, { id }) => {
  const ctx = requireReady(auth);
  const { action } = await readJson(request, z.object({ action: z.enum(["pause", "resume", "cancel"]) }));
  const automation = await changeAutomationStatus(auth.db, { userId: ctx.user.id, accountId: ctx.account.id, automationId: id, action });
  return NextResponse.json({ automation });
});
