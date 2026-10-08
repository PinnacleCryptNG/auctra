import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { safeEqual } from "@/lib/app/http";
import { getExecutionDeps } from "@/lib/app/runtime";
import { bookNextWakeUpSafely } from "@/lib/scheduler/wakeup";
import { assertTestnetEnvironment } from "@/lib/network";
import { reconcileExecutions, runDueAutomations } from "@/lib/services/executions";

export const maxDuration = 60;

// Vercel Cron calls this with GET and `Authorization: Bearer $CRON_SECRET` (PRD §10).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  assertTestnetEnvironment();
  const db = getDb();
  const deps = getExecutionDeps(db);
  const settled = await reconcileExecutions(db, deps);
  const results = await runDueAutomations(db, deps);
  // Chain: book the wake-up for the next due automation (lib/scheduler/wakeup.ts).
  const wakeUp = await bookNextWakeUpSafely(db);
  return NextResponse.json({ ran: results, settled: settled.map((e) => ({ id: e.id, status: e.status })), wakeUp });
}
