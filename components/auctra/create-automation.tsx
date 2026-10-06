"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Dialog, Field, IconCheck, Notice, Textarea } from "@/components/ui";
import { friendlyError, useApi, type PrepareResponse } from "@/lib/client/api";
import { useAuctra } from "@/lib/client/auctra-data";
import { formatDay, formatTime, formatUsdc } from "@/lib/client/format";
import { ConfirmationCard } from "./confirmation-card";
import { DestinationForm } from "./destination-form";

const EXAMPLES = {
  INDIVIDUAL: [
    "Save 20 USDC to my savings wallet every Friday at 6 PM",
    "Send 50 USDC to my savings wallet every Monday at 9:00 only if my balance is at least 300",
    "Never let my wallet fall below 300 USDC"
  ],
  BUSINESS: [
    "Pay Acme Hosting 80 USDC on the 1st of every month at 9:00, memo INV hosting",
    "Pay Ada Obi 100 USDC every Friday at 5 PM",
    "Move 50 USDC to the reserve wallet every Monday at 10:00 if the balance is at least 500"
  ]
};

type Phase =
  | { name: "compose" }
  | { name: "understanding" }
  | { name: "result"; result: PrepareResponse }
  | { name: "error"; title: string; description: string }
  | { name: "done"; firstRunAt: string; timezone: string; summary: string };

/**
 * The core experience: say it in plain words, see exactly what Auctra
 * understood, confirm. Nothing is activated before the confirm step.
 */
export function CreateAutomationDialog() {
  const { me, createRequest, closeCreate, refresh } = useAuctra();
  const { request } = useApi();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "compose" });
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const accountType = me.data?.account?.type ?? "INDIVIDUAL";

  useEffect(() => {
    if (createRequest.open) {
      setText(createRequest.text);
      setPhase({ name: "compose" });
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [createRequest.open, createRequest.text]);

  async function understand(message = text) {
    if (!message.trim()) {
      textareaRef.current?.focus();
      return;
    }
    setPhase({ name: "understanding" });
    try {
      setPhase({ name: "result", result: await request<PrepareResponse>("/api/ai/intent", { method: "POST", body: { message } }) });
    } catch (error) {
      setPhase({ name: "error", ...friendlyError(error, "Auctra couldn't read that request") });
    }
  }

  async function confirm(confirmationId: string, firstRunAt: string, timezone: string, summary: string) {
    setBusy(true);
    try {
      await request("/api/automations", { method: "POST", body: { confirmationId } });
      setPhase({ name: "done", firstRunAt, timezone, summary });
      refresh(["automations"]);
    } catch (error) {
      setPhase({ name: "error", ...friendlyError(error, "The automation wasn't created") });
    } finally {
      setBusy(false);
    }
  }

  async function setFloor(amount: string) {
    setBusy(true);
    try {
      await request("/api/settings", { method: "PATCH", body: { balanceFloor: amount } });
      setPhase({ name: "done", firstRunAt: "", timezone: "", summary: `Balance floor set to ${formatUsdc(amount)} USDC` });
      refresh(["me"]);
    } catch (error) {
      setPhase({ name: "error", ...friendlyError(error, "The balance floor wasn't saved") });
    } finally {
      setBusy(false);
    }
  }

  const edit = () => {
    setPhase({ name: "compose" });
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  let body: React.ReactNode;
  let footer: React.ReactNode = null;

  if (phase.name === "compose" || phase.name === "understanding" || (phase.name === "result" && phase.result.kind !== "confirm" && phase.result.kind !== "set_floor" && phase.result.kind !== "needs_destination") || phase.name === "error") {
    const understanding = phase.name === "understanding";
    body = (
      <form
        id="create-automation-form"
        onSubmit={(e) => {
          e.preventDefault();
          understand();
        }}
        className="grid gap-4"
      >
        <Field label="What should Auctra do?" hint="Amount, who and when. You confirm first.">
          {(p) => (
            <Textarea
              {...p}
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) understand();
              }}
              rows={3}
              maxLength={2000}
              disabled={understanding}
              placeholder={EXAMPLES[accountType][0]}
            />
          )}
        </Field>

        {phase.name === "result" && phase.result.kind === "clarify" && (
          <Notice tone="warning" title="One more detail">
            {phase.result.question} Add it to your request above.
          </Notice>
        )}
        {phase.name === "result" && phase.result.kind === "unsupported" && <Notice title="Auctra can't do that yet">{phase.result.message}</Notice>}
        {phase.name === "result" && phase.result.kind === "not_a_request" && (
          <Notice title="Describe a transfer">Say how much USDC to send, to which saved destination, and when.</Notice>
        )}
        {phase.name === "error" && (
          <Notice tone="danger" title={phase.title}>
            {phase.description}
          </Notice>
        )}

        {!understanding && (
          <div className="grid gap-2">
            <p className="text-meta">Examples</p>
            <ul className="grid gap-2">
              {EXAMPLES[accountType].map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => setText(example)}
                    className="w-full rounded-[var(--radius-input)] border border-line px-3 py-2.5 text-left text-sm text-ink-2 hover:border-slate/50 hover:bg-cloud"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p role="status" aria-live="polite" className="sr-only">
          {understanding ? "Understanding your request…" : ""}
        </p>
      </form>
    );
    footer = (
      <>
        <Button variant="secondary" onClick={closeCreate}>
          Close
        </Button>
        <Button type="submit" form="create-automation-form" loading={understanding} loadingLabel="Understanding your request…">
          Review
        </Button>
      </>
    );
  } else if (phase.name === "result" && phase.result.kind === "confirm") {
    const { preview, confirmationId, summary } = phase.result;
    body = (
      <div className="grid animate-enter gap-4">
        <p className="text-secondary">
          You said: <span className="text-ink">&ldquo;{text}&rdquo;</span>
        </p>
        <ConfirmationCard preview={preview} />
        <p className="text-xs text-slate">Nothing is set up until you confirm. This confirmation expires in 10 minutes.</p>
      </div>
    );
    footer = (
      <>
        <Button variant="secondary" onClick={edit} disabled={busy}>
          Edit
        </Button>
        <Button onClick={() => confirm(confirmationId, preview.firstRunAt, preview.timezone, summary)} loading={busy} loadingLabel="Creating automation…">
          Confirm automation
        </Button>
      </>
    );
  } else if (phase.name === "result" && phase.result.kind === "set_floor") {
    const amount = phase.result.amount;
    body = (
      <div className="grid animate-enter gap-4">
        <div className="rounded-[var(--radius-card)] border border-line p-4">
          <p className="text-meta">Balance protection</p>
          <p className="mt-1 text-h1">Keep at least {formatUsdc(amount)} USDC</p>
          <p className="mt-2 text-secondary">
            Auctra will skip any transfer that would leave your wallet with less than this. It never moves money in to top it up.
          </p>
        </div>
      </div>
    );
    footer = (
      <>
        <Button variant="secondary" onClick={edit} disabled={busy}>
          Edit
        </Button>
        <Button onClick={() => setFloor(amount)} loading={busy} loadingLabel="Saving…">
          Set balance floor
        </Button>
      </>
    );
  } else if (phase.name === "result" && phase.result.kind === "needs_destination") {
    const address = phase.result.address;
    body = (
      <div className="grid gap-4">
        <Notice tone="warning" title="This address isn't a saved destination yet">
          Auctra only sends to destinations you&apos;ve saved and confirmed. Save it below, then Auctra will read your request again.
        </Notice>
        <DestinationForm
          defaultAddress={address}
          defaultCategory={accountType === "BUSINESS" ? "VENDOR" : "SAVINGS"}
          onCancel={edit}
          onSaved={() => {
            refresh(["destinations", "me"]);
            understand();
          }}
        />
      </div>
    );
  } else if (phase.name === "done") {
    body = (
      <div role="status" className="flex animate-enter flex-col items-center gap-3 py-6 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-signal-soft text-2xl text-signal-ink">
          <IconCheck />
        </span>
        <p className="text-h2">{phase.firstRunAt ? "Automation active" : phase.summary}</p>
        {phase.firstRunAt && (
          <p className="text-secondary">
            First run {formatDay(phase.firstRunAt, phase.timezone)} at {formatTime(phase.firstRunAt, phase.timezone)}. You&apos;ll get a
            Telegram message each time it runs.
          </p>
        )}
      </div>
    );
    footer = (
      <>
        {phase.firstRunAt && (
          <Link
            href="/dashboard/automations"
            onClick={closeCreate}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-line px-4 text-sm font-medium hover:bg-cloud"
          >
            View automations
          </Link>
        )}
        <Button onClick={closeCreate}>Done</Button>
      </>
    );
  }

  const title =
    phase.name === "result" && phase.result.kind === "confirm"
      ? "Confirm automation"
      : phase.name === "result" && phase.result.kind === "needs_destination"
        ? "Save destination"
        : phase.name === "done"
          ? "All set"
          : "Create automation";

  // On the review screens, Back returns to the request exactly as typed.
  const canGoBack = phase.name === "result" && ["confirm", "set_floor", "needs_destination"].includes(phase.result.kind) && !busy;

  return (
    <Dialog open={createRequest.open} onClose={closeCreate} onBack={canGoBack ? edit : undefined} title={title} description={phase.name === "compose" ? "Tell Auctra what you want your money to do." : undefined} footer={footer} size="md">
      {body}
    </Dialog>
  );
}
