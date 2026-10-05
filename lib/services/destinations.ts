import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getAddress, isAddress } from "viem";
import type { Db } from "../../db/client";
import { automations, destinationCategory, destinations } from "../../db/schema";
import { MONAD_TESTNET_USDC_ADDRESS } from "../usdc";
import { recordAudit } from "./audit";
import { consumeConfirmation, createConfirmation } from "./confirmations";
import { UserFacingError } from "./errors";

// PRD §6 step 4 / §8: destinations are named, user-confirmed addresses.
// Automations may only pay a confirmed, non-archived destination.

export type Destination = typeof destinations.$inferSelect;
export type DestinationCategory = (typeof destinationCategory.enumValues)[number];
export const DESTINATION_CATEGORIES = destinationCategory.enumValues;

type DestinationProposal = { accountId: string; label: string; address: string; category: DestinationCategory };

export function labelKey(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

/** "my savings wallet" and "the savings wallet" find a destination saved as "Savings wallet". */
function lookupKeys(label: string) {
  const key = labelKey(label);
  const stripped = key.replace(/^(my|our|the)\s+/, "");
  return stripped === key ? [key] : [key, stripped];
}

export async function listDestinations(db: Db, accountId: string) {
  return db
    .select()
    .from(destinations)
    .where(and(eq(destinations.accountId, accountId), isNull(destinations.archivedAt), isNotNull(destinations.confirmedAt)))
    .orderBy(asc(destinations.label));
}

export async function findDestinationByLabel(db: Db, accountId: string, label: string): Promise<Destination | null> {
  for (const key of lookupKeys(label)) {
    const [found] = await db
      .select()
      .from(destinations)
      .where(and(eq(destinations.accountId, accountId), eq(destinations.labelKey, key), isNull(destinations.archivedAt)));
    if (found?.confirmedAt) return found;
  }
  return null;
}

export async function findDestinationByAddress(db: Db, accountId: string, address: string): Promise<Destination | null> {
  if (!isAddress(address)) return null;
  const [found] = await db
    .select()
    .from(destinations)
    .where(
      and(eq(destinations.accountId, accountId), eq(destinations.address, getAddress(address)), isNull(destinations.archivedAt))
    );
  return found?.confirmedAt ? found : null;
}

export function describeDestination(d: { label: string; address: string; category: DestinationCategory }) {
  return `${d.label} (${d.category.toLowerCase()}) → ${d.address}`;
}

/** Validates a new destination and creates a confirmation; nothing is saved yet. */
export async function proposeDestination(
  db: Db,
  input: { userId: string; accountId: string; walletAddress?: string | null; label: string; address: string; category?: DestinationCategory }
) {
  const label = input.label.trim().replace(/\s+/g, " ");
  if (label.length < 1 || label.length > 64) {
    throw new UserFacingError("INVALID_LABEL", "A destination name must be 1–64 characters.");
  }
  if (!isAddress(input.address)) throw new UserFacingError("INVALID_ADDRESS", "That is not a valid wallet address.");

  const address = getAddress(input.address);
  if (address === MONAD_TESTNET_USDC_ADDRESS) {
    throw new UserFacingError("INVALID_ADDRESS", "That is the USDC token contract, not a wallet.");
  }
  if (input.walletAddress && address === getAddress(input.walletAddress)) {
    throw new UserFacingError("INVALID_ADDRESS", "That is your own Auctra wallet.");
  }

  const category = input.category ?? "OTHER";
  if (!DESTINATION_CATEGORIES.includes(category)) throw new UserFacingError("INVALID_CATEGORY", "Unknown destination category.");

  const existing = await db
    .select()
    .from(destinations)
    .where(and(eq(destinations.accountId, input.accountId), isNull(destinations.archivedAt)));
  if (existing.some((d) => d.labelKey === labelKey(label))) {
    throw new UserFacingError("DUPLICATE_LABEL", `You already have a destination called "${label}".`);
  }
  const sameAddress = existing.find((d) => d.address === address);
  if (sameAddress) {
    throw new UserFacingError("DUPLICATE_ADDRESS", `That address is already saved as "${sameAddress.label}".`);
  }

  const payload: DestinationProposal = { accountId: input.accountId, label, address, category };
  const confirmation = await createConfirmation(db, { userId: input.userId, kind: "DESTINATION", payload });
  return { confirmationId: confirmation.id, proposal: payload };
}

export async function confirmDestination(db: Db, input: { confirmationId: string; userId: string; accountId: string }) {
  const proposal = await consumeConfirmation<DestinationProposal>(db, {
    id: input.confirmationId,
    userId: input.userId,
    kind: "DESTINATION"
  });
  if (proposal.accountId !== input.accountId) {
    throw new UserFacingError("CONFIRMATION_INVALID", "This confirmation belongs to a different account.");
  }

  const [destination] = await db
    .insert(destinations)
    .values({
      accountId: proposal.accountId,
      label: proposal.label,
      labelKey: labelKey(proposal.label),
      address: proposal.address,
      category: proposal.category,
      confirmedAt: new Date()
    })
    .onConflictDoNothing()
    .returning();
  if (!destination) throw new UserFacingError("DUPLICATE_DESTINATION", "That name or address was saved in the meantime.");

  await recordAudit(db, {
    accountId: proposal.accountId,
    userId: input.userId,
    eventType: "DESTINATION_SAVED",
    metadata: { destinationId: destination.id, label: destination.label, address: destination.address, category: destination.category }
  });
  return destination;
}

/** Archives a destination and cancels every automation that pays it. */
export async function archiveDestination(db: Db, input: { userId: string; accountId: string; destinationId: string }) {
  const [destination] = await db
    .update(destinations)
    .set({ archivedAt: new Date() })
    .where(and(eq(destinations.id, input.destinationId), eq(destinations.accountId, input.accountId), isNull(destinations.archivedAt)))
    .returning();
  if (!destination) throw new UserFacingError("NOT_FOUND", "Destination not found.");

  const cancelled = await db
    .update(automations)
    .set({ status: "CANCELLED", nextRunAt: null, updatedAt: new Date() })
    .where(and(eq(automations.destinationId, destination.id), inArray(automations.status, ["ACTIVE", "PAUSED"])))
    .returning({ id: automations.id });

  await recordAudit(db, {
    accountId: input.accountId,
    userId: input.userId,
    eventType: "DESTINATION_ARCHIVED",
    metadata: { destinationId: destination.id, cancelledAutomationIds: cancelled.map((a) => a.id) }
  });
  return { destination, cancelledAutomations: cancelled.length };
}
