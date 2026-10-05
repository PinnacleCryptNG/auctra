import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../../db/client";
import { confirmations } from "../../db/schema";
import { UserFacingError } from "./errors";
import { canonicalJson, sha256 } from "./hash";

// PRD §11: a confirmation is bound to one user, expires after 10 minutes,
// can be used once, and its payload must still match the hash it was shown with.

export const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

type Kind = "AUTOMATION" | "DESTINATION";

export async function createConfirmation<T>(db: Db, input: { userId: string; kind: Kind; payload: T }, now = new Date()) {
  const [confirmation] = await db
    .insert(confirmations)
    .values({
      userId: input.userId,
      kind: input.kind,
      intentHash: sha256(canonicalJson(input.payload)),
      payload: input.payload,
      expiresAt: new Date(now.getTime() + CONFIRMATION_TTL_MS)
    })
    .returning();
  return confirmation;
}

export async function consumeConfirmation<T>(
  db: Db,
  input: { id: string; userId: string; kind: Kind },
  now = new Date()
): Promise<T> {
  const [confirmation] = await db
    .update(confirmations)
    .set({ confirmedAt: now })
    .where(
      and(
        eq(confirmations.id, input.id),
        eq(confirmations.userId, input.userId),
        eq(confirmations.kind, input.kind),
        isNull(confirmations.confirmedAt),
        gt(confirmations.expiresAt, now)
      )
    )
    .returning();

  if (!confirmation) {
    throw new UserFacingError("CONFIRMATION_INVALID", "This confirmation has expired or was already used. Please start again.");
  }
  if (sha256(canonicalJson(confirmation.payload)) !== confirmation.intentHash) {
    throw new UserFacingError("CONFIRMATION_TAMPERED", "This confirmation no longer matches what you were shown.");
  }
  return confirmation.payload as T;
}
