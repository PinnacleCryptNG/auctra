import type { Db } from "../../db/client";
import { auditEvents } from "../../db/schema";

export async function recordAudit(
  db: Db,
  event: { accountId?: string | null; userId?: string | null; eventType: string; metadata?: Record<string, unknown> }
) {
  await db.insert(auditEvents).values({
    accountId: event.accountId ?? null,
    userId: event.userId ?? null,
    eventType: event.eventType,
    metadata: event.metadata ?? {}
  });
}
