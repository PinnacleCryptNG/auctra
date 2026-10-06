// Presentation helpers shared by the dashboard, onboarding and landing page.
// Pure functions over the API's data model; no backend logic lives here.

import type { AutomationSchedule } from "../automation-types";
import type { DisplayStatus } from "@/components/ui/badge";

const DAY_NAMES: Record<string, string> = {
  MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday", THURSDAY: "Thursday",
  FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday"
};

function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** "18:00" → "6:00 PM" */
export function formatClock(time: string) {
  const [h, m] = time.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Splits a schedule into a cadence ("Every Friday") and a time ("6:00 PM"). */
export function scheduleParts(schedule: AutomationSchedule): { cadence: string; time: string } {
  const time = formatClock(schedule.time);
  switch (schedule.frequency) {
    case "ONCE":
      return { cadence: `Once on ${formatDay(`${schedule.date}T12:00:00Z`, "UTC")}`, time };
    case "DAILY":
      return { cadence: "Every day", time };
    case "WEEKLY":
      return { cadence: `Every ${DAY_NAMES[schedule.dayOfWeek]}`, time };
    case "MONTHLY":
      return { cadence: `On the ${ordinal(schedule.dayOfMonth)} of every month`, time };
  }
}

export function scheduleSentence(schedule: AutomationSchedule) {
  const { cadence, time } = scheduleParts(schedule);
  return `${cadence.charAt(0).toLowerCase()}${cadence.slice(1)} at ${time}`;
}

/** "20.000000" → "20", "1342.5" → "1,342.50" */
export function formatUsdc(amount: string | number) {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  const decimals = Number.isInteger(n) ? 0 : n * 100 === Math.round(n * 100) ? 2 : 6;
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatDay(iso: string, timezone?: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string, timezone?: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatDate(iso: string, timezone?: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(iso: string, timezone?: string) {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
}

/** A plain-language verb for what an automation does, from the destination's category. */
export function actionLabel(category: string) {
  switch (category) {
    case "SAVINGS":
      return "Save";
    case "TREASURY":
      return "Move to reserve";
    case "VENDOR":
    case "CONTRACTOR":
    case "EMPLOYEE":
    case "PERSONAL":
      return "Pay";
    default:
      return "Send";
  }
}

export function categoryLabel(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

export function automationStatus(status: string): DisplayStatus {
  switch (status) {
    case "ACTIVE":
      return "ACTIVE";
    case "PAUSED":
      return "PAUSED";
    case "COMPLETED":
      return "COMPLETED";
    default:
      return "CANCELLED";
  }
}

export function executionStatus(status: string): DisplayStatus {
  switch (status) {
    case "CONFIRMED":
      return "COMPLETED";
    case "PENDING":
    case "SUBMITTED":
      return "PENDING";
    case "SKIPPED":
      return "SKIPPED";
    case "UNKNOWN":
      return "REVIEW";
    default:
      return "FAILED";
  }
}

/**
 * Plain-language reason for an execution outcome, keyed by the backend's
 * error code. Raw backend messages are never shown.
 */
export function executionReason(execution: { status: string; errorCode: string | null; trigger?: string }) {
  switch (execution.errorCode) {
    case null:
      if (execution.status === "CONFIRMED") return execution.trigger === "MANUAL" ? "Sent with Run now" : "Sent on schedule";
      if (execution.status === "SUBMITTED" || execution.status === "PENDING") return "Waiting for the network to confirm";
      return "Nothing was sent";
    case "INSUFFICIENT_BALANCE":
      return "Your testnet USDC balance was too low, so nothing was sent.";
    case "CONDITION_NOT_MET":
      return "Your balance was below the condition you set, so this run was skipped.";
    case "BALANCE_FLOOR":
      return "This would have taken your wallet below its balance floor, so it was skipped.";
    case "DAILY_CAP":
      return "This would have gone over the daily limit, so it was skipped.";
    case "MISSING_PERMISSION":
      return "Auctra didn't have permission to send from your wallet.";
    case "PERMISSION_STALE":
      return "Your saved destinations changed, so Auctra's permission needs your approval again.";
    case "MISSED_WINDOW":
      return "This run was missed by more than a day, so it was skipped.";
    case "PREFLIGHT_ERROR":
      return "Auctra couldn't check your balance, so nothing was sent.";
    case "PROVIDER_REJECTED":
      return "Your wallet's safety policy blocked this transfer. Nothing was sent.";
    case "TX_REVERTED":
      return "The network rejected this transfer.";
    case "OUTCOME_UNKNOWN":
    case "RECEIPT_NOT_FOUND":
      return "We couldn't confirm this transfer. Check your wallet before running it again.";
    case "SUBMIT_ERROR":
      return "Still checking whether this transfer went through.";
    default:
      return "Blocked by a safety check. Nothing was sent.";
  }
}
