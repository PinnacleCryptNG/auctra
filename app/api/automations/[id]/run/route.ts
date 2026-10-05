import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireReady, withAuth } from "@/lib/app/http";
import { getExecutionDeps } from "@/lib/app/runtime";
import { runNow } from "@/lib/services/executions";

export const maxDuration = 60;

// Run Now (PRD §10): the client sends a requestId, so retries of the same click can't double-send.
export const POST = withAuth<{ id: string }>(async (auth, request, { id }) => {
  const ctx = requireReady(auth);
  const { requestId } = await readJson(request, z.object({ requestId: z.string().regex(/^[\w-]{8,64}$/) }));
  const execution = await runNow(auth.db, getExecutionDeps(auth.db), {
    accountId: ctx.account.id,
    automationId: id,
    requestId,
    userId: ctx.user.id
  });
  return NextResponse.json({ execution });
});
