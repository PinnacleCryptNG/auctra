"use client";

import { useState } from "react";
import { Button, ConfirmDialog, IconPause, IconPlay, IconSend, Notice, StatusBadge } from "@/components/ui";
import { friendlyError, useApi, type Automation } from "@/lib/client/api";
import { actionLabel, automationStatus, formatDay, formatTime, formatUsdc, scheduleSentence } from "@/lib/client/format";

/**
 * One automation at a glance: action, amount, schedule, destination, status,
 * next run, and the actions that apply to its current state.
 */
export function AutomationCard({ automation, onChanged }: { automation: Automation; onChanged: () => Promise<void> | void }) {
  const { request } = useApi();
  const [busy, setBusy] = useState<null | "run" | "pause" | "resume" | "cancel">(null);
  const [confirming, setConfirming] = useState<null | "run" | "cancel">(null);
  const [result, setResult] = useState<{ tone: "success" | "danger" | "warning"; title: string; text?: string } | null>(null);

  const active = automation.status === "ACTIVE";
  const paused = automation.status === "PAUSED";
  const condition = automation.conditions[0];
  const amount = `${formatUsdc(automation.amount)} USDC`;

  async function change(action: "pause" | "resume" | "cancel") {
    setBusy(action);
    setResult(null);
    try {
      await request(`/api/automations/${automation.id}`, { method: "PATCH", body: { action } });
      await onChanged();
    } catch (error) {
      setResult({ tone: "danger", ...asResult(friendlyError(error, `Couldn't ${action} this automation`)) });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  async function runNow() {
    setBusy("run");
    setResult(null);
    try {
      const { execution } = await request<{ execution: { status: string } }>(`/api/automations/${automation.id}/run`, {
        method: "POST",
        body: { requestId: `web-${crypto.randomUUID()}` }
      });
      setResult(
        execution.status === "CONFIRMED"
          ? { tone: "success", title: `Sent ${amount} to ${automation.destination.label}` }
          : execution.status === "SUBMITTED" || execution.status === "PENDING"
            ? { tone: "warning", title: "Transfer submitted", text: "Confirming. It will show in Activity." }
            : { tone: "warning", title: "Nothing was sent", text: "See Activity for the reason." }
      );
      await onChanged();
    } catch (error) {
      setResult({ tone: "danger", ...asResult(friendlyError(error, "Transfer couldn't be started")) });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  return (
    <article aria-label={`${actionLabel(automation.destination.category)} ${amount} to ${automation.destination.label}`} className="flex min-w-0 animate-enter flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="grid gap-3 px-4 pt-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-meta">{actionLabel(automation.destination.category)}</p>
          <StatusBadge status={automationStatus(automation.status)} />
        </div>
        <div className="grid gap-1">
          <p className="text-[1.5rem] leading-tight font-semibold tracking-[-0.015em] tabular-nums">{amount}</p>
          <p className="text-body text-ink-2">{scheduleSentence(automation.schedule)}</p>
        </div>
        <p className="text-sm text-ink-2">
          to <span className="font-medium text-ink">{automation.destination.label}</span>
          {condition && <span> · only if balance ≥ {formatUsdc(condition.amount)} USDC</span>}
          {automation.memo && <span className="text-slate"> · {automation.memo}</span>}
        </p>
      </div>

      {result && (
        <div className="px-4 sm:px-5">
          <Notice tone={result.tone} title={result.title}>
            {result.text}
          </Notice>
        </div>
      )}

      <footer className="mt-auto flex flex-col gap-3 border-t border-line px-4 py-3 sm:px-5">
        <p className="text-sm">
          {active && automation.nextRunAt ? (
            <>
              <span className="text-slate">Next </span>
              <span className="font-medium">
                {formatDay(automation.nextRunAt, automation.timezone)}, {formatTime(automation.nextRunAt, automation.timezone)}
              </span>
            </>
          ) : paused ? (
            <span className="text-slate">Paused. Resume to schedule the next run.</span>
          ) : (
            <span className="text-slate">{automation.executionCount} {automation.executionCount === 1 ? "transfer" : "transfers"} sent</span>
          )}
        </p>
        {(active || paused) && (
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 min-[480px]:flex min-[480px]:flex-wrap">
            {active && (
              <Button size="sm" variant="secondary" icon={<IconSend />} onClick={() => setConfirming("run")} loading={busy === "run"} loadingLabel="Sending…">
                Run now
              </Button>
            )}
            {active ? (
              <Button size="sm" variant="secondary" icon={<IconPause />} onClick={() => change("pause")} loading={busy === "pause"} loadingLabel="Pausing…">
                Pause
              </Button>
            ) : (
              <Button size="sm" variant="secondary" icon={<IconPlay />} onClick={() => change("resume")} loading={busy === "resume"} loadingLabel="Resuming…" className="col-span-2">
                Resume
              </Button>
            )}
            <Button size="sm" variant="danger-ghost" onClick={() => setConfirming("cancel")}>
              Cancel
            </Button>
          </div>
        )}
      </footer>

      <ConfirmDialog
        open={confirming === "run"}
        onClose={() => setConfirming(null)}
        title={`Send ${amount} now?`}
        description={`Auctra will send ${amount} to ${automation.destination.label} now. Scheduled runs stay the same.`}
        confirmLabel="Send now"
        tone="primary"
        busy={busy === "run"}
        onConfirm={runNow}
      />
      <ConfirmDialog
        open={confirming === "cancel"}
        onClose={() => setConfirming(null)}
        title="Cancel this automation?"
        description={`Auctra will stop sending ${amount} to ${automation.destination.label}. This can't be undone; you can create a new automation later.`}
        confirmLabel="Cancel automation"
        busy={busy === "cancel"}
        onConfirm={() => change("cancel")}
      />
    </article>
  );
}

function asResult({ title, description }: { title: string; description: string }) {
  return { title, text: description };
}
