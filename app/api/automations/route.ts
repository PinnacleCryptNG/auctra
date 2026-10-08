import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireReady, withAuth } from "@/lib/app/http";
import { bookNextWakeUpSafely } from "@/lib/scheduler/wakeup";
import { activateAutomation, describeAutomation, listAutomations } from "@/lib/services/automations";

export const GET = withAuth(async (auth) => {
  const ctx = requireReady(auth);
  const rows = await listAutomations(auth.db, ctx.account.id);
  return NextResponse.json({
    automations: rows.map(({ automation, destination }) => ({
      ...automation,
      description: describeAutomation(automation, destination),
      destination: { id: destination.id, label: destination.label, address: destination.address, category: destination.category }
    }))
  });
});

/** Activates an automation from a confirmation the user was shown (PRD §6 step 9). */
export const POST = withAuth(async (auth, request) => {
  const ctx = requireReady(auth);
  const { confirmationId } = await readJson(request, z.object({ confirmationId: z.string().uuid() }));
  const automation = await activateAutomation(auth.db, ctx, confirmationId);
  await bookNextWakeUpSafely(auth.db);
  return NextResponse.json({ automation });
});
