import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireReady, withAuth } from "@/lib/app/http";
import { createClaudeIntentModel, parseIntent } from "@/lib/ai/intent-parser";
import { prepareAutomation } from "@/lib/services/automations";

// PRD §19: natural language → FinancialIntent → confirmation summary. Never activates anything.
export const POST = withAuth(async (auth, request) => {
  const ctx = requireReady(auth);
  const { message } = await readJson(request, z.object({ message: z.string().min(1).max(2000) }));
  const result = await parseIntent(createClaudeIntentModel(), { message, timezone: ctx.user.timezone });
  if (result.kind !== "intent") return NextResponse.json(result);
  return NextResponse.json(await prepareAutomation(auth.db, ctx, result.intent));
});
