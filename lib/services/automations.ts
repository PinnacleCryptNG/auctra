import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/client";
import { automations, destinations } from "../../db/schema";
import type { AutomationCondition, AutomationSchedule } from "../automation-types";
import { AuctraConfig } from "../config";
import type { FinancialIntent } from "../financial-intent";
import { formatDateTime, formatUsdc } from "../format";
import { describeSchedule, nextOccurrence } from "../schedule";
import { parseUsdcAmount } from "../usdc";
import type { AccountContext } from "./accounts";
import { accountDisplayName } from "./accounts";
import { recordAudit } from "./audit";
import { consumeConfirmation, createConfirmation } from "./confirmations";
import { describeDestination, findDestinationByAddress, findDestinationByLabel } from "./destinations";
import { UserFacingError } from "./errors";

export type Automation = typeof automations.$inferSelect;

type AutomationProposal = {
  accountId: string;
  walletId: string;
  destinationId: string;
  amount: string;
  schedule: AutomationSchedule;
  timezone: string;
  conditions: AutomationCondition[];
  memo: string | null;
};

export type PrepareResult =
  | { kind: "confirm"; confirmationId: string; summary: string }
  | { kind: "needs_destination"; address: string };

function requireReadyContext(ctx: AccountContext) {
  if (!ctx.account) throw new UserFacingError("NO_ACCOUNT", "Finish setting up your Auctra account first (send /start).");
  if (!ctx.wallet) throw new UserFacingError("NO_WALLET", "Set up your Auctra wallet first (send /start).");
  return { account: ctx.account, wallet: ctx.wallet };
}

function validateAmount(amount: string) {
  if (parseUsdcAmount(amount) > parseUsdcAmount(AuctraConfig.maxTransferUsdc)) {
    throw new UserFacingError(
      "AMOUNT_ABOVE_CAP",
      `The most Auctra can send in one transfer is ${AuctraConfig.maxTransferUsdc} USDC during the testnet MVP.`
    );
  }
}

/**
 * Turns a validated intent into a confirmation request (PRD §6 steps 7–8).
 * Nothing is activated until the user confirms the exact summary.
 */
export async function prepareAutomation(
  db: Db,
  ctx: AccountContext,
  intent: FinancialIntent,
  now = new Date()
): Promise<PrepareResult> {
  const { account, wallet } = requireReadyContext(ctx);

  let destination;
  if ("label" in intent.destination) {
    destination = await findDestinationByLabel(db, account.id, intent.destination.label);
    if (!destination) {
      throw new UserFacingError(
        "UNKNOWN_DESTINATION",
        `I don't have a saved destination called "${intent.destination.label}". Save it first with /destinations.`
      );
    }
  } else {
    destination = await findDestinationByAddress(db, account.id, intent.destination.address);
    if (!destination) return { kind: "needs_destination", address: intent.destination.address };
  }

  validateAmount(intent.amount);
  const timezone = ctx.user.timezone;
  const firstRun = nextOccurrence(intent.schedule, timezone, now);
  if (!firstRun) throw new UserFacingError("SCHEDULE_IN_PAST", "That date and time has already passed.");

  const proposal: AutomationProposal = {
    accountId: account.id,
    walletId: wallet.id,
    destinationId: destination.id,
    amount: intent.amount,
    schedule: intent.schedule,
    timezone,
    conditions: intent.conditions,
    memo: intent.memo ?? null
  };

  const lines = [
    "Please confirm this automation:",
    `• Send: ${formatUsdc(intent.amount)} USDC`,
    `• To: ${describeDestination(destination)}`,
    `• When: ${describeSchedule(intent.schedule, timezone)}`,
    `• First run: ${formatDateTime(firstRun, timezone)}`,
    ...intent.conditions.map((c) => `• Only if: wallet balance is at least ${formatUsdc(c.amount)} USDC before sending`),
    ...(wallet.balanceFloor ? [`• Never below: ${formatUsdc(wallet.balanceFloor)} USDC left after sending (your balance floor)`] : []),
    ...(proposal.memo ? [`• Memo: ${proposal.memo}`] : []),
    `• From: ${accountDisplayName(account)} wallet ${wallet.address}`,
    "Runs on Monad Testnet with test funds only."
  ];

  const confirmation = await createConfirmation(db, { userId: ctx.user.id, kind: "AUTOMATION", payload: proposal });
  return { kind: "confirm", confirmationId: confirmation.id, summary: lines.join("\n") };
}

export async function activateAutomation(
  db: Db,
  ctx: AccountContext,
  confirmationId: string,
  now = new Date()
): Promise<Automation> {
  const { account, wallet } = requireReadyContext(ctx);
  const proposal = await consumeConfirmation<AutomationProposal>(db, {
    id: confirmationId,
    userId: ctx.user.id,
    kind: "AUTOMATION"
  });
  if (proposal.accountId !== account.id || proposal.walletId !== wallet.id) {
    throw new UserFacingError("CONFIRMATION_INVALID", "This confirmation belongs to a different account or wallet.");
  }

  const [destination] = await db.select().from(destinations).where(eq(destinations.id, proposal.destinationId));
  if (!destination || destination.archivedAt || !destination.confirmedAt || destination.accountId !== account.id) {
    throw new UserFacingError("UNKNOWN_DESTINATION", "That destination is no longer available.");
  }
  validateAmount(proposal.amount);

  const nextRunAt = nextOccurrence(proposal.schedule, proposal.timezone, now);
  if (!nextRunAt) throw new UserFacingError("SCHEDULE_IN_PAST", "That date and time has already passed.");

  const [automation] = await db
    .insert(automations)
    .values({
      accountId: account.id,
      walletId: wallet.id,
      destinationId: destination.id,
      createdByUserId: ctx.user.id,
      action: "TRANSFER",
      asset: "USDC",
      amount: proposal.amount,
      schedule: proposal.schedule,
      timezone: proposal.timezone,
      conditions: proposal.conditions,
      memo: proposal.memo,
      status: "ACTIVE",
      nextRunAt
    })
    .returning();

  await recordAudit(db, {
    accountId: account.id,
    userId: ctx.user.id,
    eventType: "AUTOMATION_ACTIVATED",
    metadata: { automationId: automation.id, confirmationId, ...proposal }
  });
  return automation;
}

export async function listAutomations(db: Db, accountId: string, statuses?: Automation["status"][]) {
  return db
    .select({ automation: automations, destination: destinations })
    .from(automations)
    .innerJoin(destinations, eq(destinations.id, automations.destinationId))
    .where(and(eq(automations.accountId, accountId), statuses ? inArray(automations.status, statuses) : undefined))
    .orderBy(desc(automations.createdAt));
}

export async function getAutomation(db: Db, accountId: string, automationId: string) {
  const [row] = await db
    .select({ automation: automations, destination: destinations })
    .from(automations)
    .innerJoin(destinations, eq(destinations.id, automations.destinationId))
    .where(and(eq(automations.id, automationId), eq(automations.accountId, accountId)));
  return row ?? null;
}

export type StatusAction = "pause" | "resume" | "cancel";

/** PRD §6 step 14. Resuming recomputes the next run from now; missed runs are not replayed. */
export async function changeAutomationStatus(
  db: Db,
  input: { userId: string; accountId: string; automationId: string; action: StatusAction },
  now = new Date()
): Promise<Automation> {
  const row = await getAutomation(db, input.accountId, input.automationId);
  if (!row) throw new UserFacingError("NOT_FOUND", "Automation not found.");
  const current = row.automation;

  let update: Partial<Automation>;
  let allowedFrom: Automation["status"][];
  switch (input.action) {
    case "pause":
      allowedFrom = ["ACTIVE"];
      update = { status: "PAUSED" };
      break;
    case "cancel":
      allowedFrom = ["ACTIVE", "PAUSED"];
      update = { status: "CANCELLED", nextRunAt: null };
      break;
    case "resume": {
      allowedFrom = ["PAUSED"];
      if (row.destination.archivedAt) throw new UserFacingError("UNKNOWN_DESTINATION", "That destination was removed.");
      const nextRunAt = nextOccurrence(current.schedule, current.timezone, now);
      if (!nextRunAt) throw new UserFacingError("SCHEDULE_IN_PAST", "This one-time automation's date has passed.");
      update = { status: "ACTIVE", nextRunAt };
      break;
    }
  }

  const [updated] = await db
    .update(automations)
    .set({ ...update, updatedAt: now })
    .where(and(eq(automations.id, current.id), inArray(automations.status, allowedFrom)))
    .returning();
  if (!updated) {
    throw new UserFacingError("INVALID_STATUS", `This automation is ${current.status.toLowerCase()} and can't be ${input.action}d.`);
  }

  await recordAudit(db, {
    accountId: input.accountId,
    userId: input.userId,
    eventType: `AUTOMATION_${updated.status}`,
    metadata: { automationId: updated.id, from: current.status }
  });
  return updated;
}

export function describeAutomation(automation: Automation, destination: { label: string }) {
  const condition = automation.conditions[0];
  return [
    `${formatUsdc(automation.amount)} USDC → ${destination.label}, ${describeSchedule(automation.schedule, automation.timezone)}`,
    condition ? ` if balance ≥ ${formatUsdc(condition.amount)} USDC` : "",
    automation.memo ? ` · memo: ${automation.memo}` : ""
  ].join("");
}
