import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { Db } from "../../db/client";
import { automations } from "../../db/schema";
import { siteUrl } from "../site";

// On-time scheduling. Vercel only runs code when a request arrives, so the
// app books a wake-up call with Upstash QStash for the moment the next
// automation is due. QStash calls /api/cron/execute at that exact time; that
// run then books the next one. The GitHub Actions scheduler stays as a backup.
//
// QStash forwards `Authorization: Bearer $CRON_SECRET` (Upstash-Forward-*), so
// the cron endpoint authenticates the call exactly as it does any other caller.

type Env = Record<string, string | undefined>;

export type WakeUpResult =
  | { booked: string; at: string }
  | { skipped: "NOT_CONFIGURED" | "NOTHING_SCHEDULED" }
  | { failed: number | string };

export async function bookNextWakeUp(
  db: Db,
  { env = process.env, fetchImpl = fetch, now = new Date() }: { env?: Env; fetchImpl?: typeof fetch; now?: Date } = {}
): Promise<WakeUpResult> {
  const token = env.QSTASH_TOKEN;
  const cronSecret = env.CRON_SECRET;
  if (!token || !cronSecret) return { skipped: "NOT_CONFIGURED" };

  const [next] = await db
    .select({ nextRunAt: automations.nextRunAt })
    .from(automations)
    .where(and(eq(automations.status, "ACTIVE"), isNotNull(automations.nextRunAt)))
    .orderBy(asc(automations.nextRunAt))
    .limit(1);
  if (!next?.nextRunAt) return { skipped: "NOTHING_SCHEDULED" };

  // Never before the due time; a second later so the run always finds it due.
  const due = Math.max(next.nextRunAt.getTime(), now.getTime());
  const notBefore = Math.ceil(due / 1000) + 1;
  const endpoint = `${siteUrl().origin}/api/cron/execute`;
  const base = (env.QSTASH_URL || "https://qstash.upstash.io").replace(/\/$/, "");

  try {
    const response = await fetchImpl(`${base}/v2/publish/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Upstash-Method": "GET",
        "Upstash-Not-Before": String(notBefore),
        // One wake-up per due second, however many times it is booked.
        "Upstash-Deduplication-Id": `auctra-wake-${notBefore}`,
        "Upstash-Retries": "3",
        "Upstash-Forward-Authorization": `Bearer ${cronSecret}`
      }
    });
    if (!response.ok) return { failed: response.status };
    const body = (await response.json().catch(() => ({}))) as { messageId?: string };
    return { booked: body.messageId ?? "ok", at: new Date(notBefore * 1000).toISOString() };
  } catch (error) {
    return { failed: error instanceof Error ? error.name : "error" };
  }
}

/** Fire-and-forget form for request handlers: a missed booking is caught by the backup scheduler. */
export async function bookNextWakeUpSafely(db: Db) {
  const result = await bookNextWakeUp(db).catch(() => ({ failed: "error" }) as WakeUpResult);
  if ("failed" in result) console.error("Wake-up booking failed", result.failed);
  return result;
}
