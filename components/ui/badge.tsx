import type { ReactNode } from "react";
import { IconAlert, IconCheck, IconClock, IconDot, IconPause, IconSkip, IconX } from "./icons";

type Tone = "neutral" | "success" | "warning" | "danger" | "testnet";
const tones: Record<Tone, string> = {
  neutral: "border-line bg-cloud text-ink-2",
  success: "border-signal/40 bg-signal-soft text-signal-ink",
  warning: "border-amber/50 bg-amber-soft text-amber-ink",
  danger: "border-danger/30 bg-danger-soft text-danger-ink",
  testnet: "border-amber/50 bg-amber-soft text-amber-ink"
};

/** Small label. Squared-off (6px), not a pill. */
export function Badge({ tone = "neutral", icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border px-2 py-0.5 text-xs font-medium leading-5 ${tones[tone]}`}>
      {icon && <span className="text-[0.875rem]">{icon}</span>}
      {children}
    </span>
  );
}

export function TestnetBadge({ compact }: { compact?: boolean }) {
  return (
    <Badge tone="testnet" icon={<IconDot />}>
      {compact ? "Testnet" : "Monad Testnet"}
    </Badge>
  );
}

/**
 * The six user-facing states (plus "Cancelled"/"Needs review"), each with an
 * icon and a word so state never depends on colour alone.
 */
export type DisplayStatus = "ACTIVE" | "PAUSED" | "PENDING" | "COMPLETED" | "SKIPPED" | "FAILED" | "CANCELLED" | "REVIEW";

const STATUS: Record<DisplayStatus, { label: string; tone: Tone; icon: ReactNode }> = {
  ACTIVE: { label: "Active", tone: "success", icon: <IconDot /> },
  PAUSED: { label: "Paused", tone: "warning", icon: <IconPause /> },
  PENDING: { label: "Pending", tone: "warning", icon: <IconClock /> },
  COMPLETED: { label: "Completed", tone: "success", icon: <IconCheck /> },
  SKIPPED: { label: "Skipped", tone: "warning", icon: <IconSkip /> },
  FAILED: { label: "Failed", tone: "danger", icon: <IconX /> },
  CANCELLED: { label: "Cancelled", tone: "neutral", icon: <IconX /> },
  REVIEW: { label: "Needs review", tone: "danger", icon: <IconAlert /> }
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}
