"use client";

import type { ReactNode } from "react";
import { IconAlert } from "./icons";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

/** Skeleton block for content that is loading. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-[6px] bg-slate-soft ${className}`} />;
}

/** An intentional loading state: says what is happening, announced politely. */
export function LoadingState({ label, rows = 2 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-3 py-2">
      <span className="text-secondary flex items-center gap-2">
        <Spinner className="text-slate" />
        {label}
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      {icon && <span className="grid size-11 place-items-center rounded-full bg-slate-soft text-xl text-ink-2">{icon}</span>}
      <div className="grid max-w-sm gap-1">
        <p className="text-h3">{title}</p>
        {description && <p className="text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-danger/30 bg-danger-soft p-4 sm:flex-row sm:items-center">
      <IconAlert className="mt-0.5 shrink-0 text-lg text-danger-ink" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-h3 text-danger-ink">{title}</p>
        {description && <p className="text-sm text-ink-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = "info" | "success" | "warning" | "danger";
const noticeTones: Record<Tone, string> = {
  info: "border-line bg-surface text-ink-2",
  success: "border-signal/40 bg-signal-soft text-signal-ink",
  warning: "border-amber/50 bg-amber-soft text-amber-ink",
  danger: "border-danger/30 bg-danger-soft text-danger-ink"
};

/** Inline message. Warnings/dangers are announced as alerts, others politely. */
export function Notice({ tone = "info", title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={`flex flex-col gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-sm sm:flex-row sm:items-center ${noticeTones[tone]}`}
    >
      <div className="grid min-w-0 flex-1 gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-2">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
