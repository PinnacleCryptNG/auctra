"use client";

import { usePrivy, useSigners } from "@privy-io/react-auth";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AddDestination } from "@/components/add-destination";
import { Button, Card, Input, Label, Mono, Notice, TestnetBadge } from "@/components/ui";
import { useApi, type Destination, type Me } from "@/lib/client/api";

// PRD §12: makes state and execution legible. Telegram stays the primary surface.

type Automation = {
  id: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
  description: string;
  nextRunAt: string | null;
  timezone: string;
  executionCount: number;
  memo: string | null;
};
type Execution = {
  id: string;
  status: string;
  trigger: string;
  amount: string;
  createdAt: string;
  txHash: string | null;
  explorerUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  memo: string | null;
  destination: { label: string; category: string };
};
type Balance = { usdc: string; mon: string; address: string };
type PrepareResponse =
  | { kind: "confirm"; confirmationId: string; summary: string }
  | { kind: "needs_destination"; address: string }
  | { kind: "clarify"; question: string }
  | { kind: "unsupported"; message: string }
  | { kind: "not_a_request" };

const STATUS_TONE: Record<string, string> = {
  CONFIRMED: "text-signal",
  ACTIVE: "text-signal",
  SUBMITTED: "text-amber",
  PENDING: "text-amber",
  PAUSED: "text-amber",
  SKIPPED: "text-amber",
  FAILED: "text-danger",
  REJECTED: "text-danger",
  UNKNOWN: "text-danger",
  CANCELLED: "text-slate",
  COMPLETED: "text-slate"
};

function when(iso: string | null, timezone?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" });
}

export default function DashboardPage() {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Notice tone="warn">Privy is not configured (NEXT_PUBLIC_PRIVY_APP_ID).</Notice>
      </main>
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { request, download } = useApi();
  const [me, setMe] = useState<Me | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const nextMe = await request<Me>("/api/me");
      setMe(nextMe);
      if (!nextMe.wallet) return;
      const [a, d, e] = await Promise.all([
        request<{ automations: Automation[] }>("/api/automations"),
        request<{ destinations: Destination[] }>("/api/destinations"),
        request<{ executions: Execution[] }>("/api/executions")
      ]);
      setAutomations(a.automations);
      setDestinations(d.destinations);
      setExecutions(e.executions);
      request<Balance>("/api/balance").then(setBalance).catch(() => setBalance(null));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);

  useEffect(() => {
    if (ready && authenticated) refresh();
  }, [ready, authenticated, refresh]);

  if (!ready) return <main className="p-10 text-slate">Loading…</main>;
  if (!authenticated) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Card>
          <h1 className="mb-4 text-2xl font-semibold">Auctra dashboard</h1>
          <Button onClick={login}>Log in</Button>
        </Card>
      </main>
    );
  }
  if (me && (!me.account || !me.wallet)) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Card>
          <p className="mb-4 text-sm">Finish setting up your account first.</p>
          <Link className="text-signal underline" href="/onboarding">Continue setup</Link>
        </Card>
      </main>
    );
  }

  const accountName = me?.account?.type === "BUSINESS" ? me.account.businessName : "Personal account";

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-mono text-sm uppercase tracking-[0.2em] text-signal">Auctra</span>
          <h1 className="text-xl font-semibold">
            {accountName}
            {me?.account?.type === "BUSINESS" && <span className="ml-2 text-xs font-normal text-slate">business</span>}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <TestnetBadge />
          <Button variant="secondary" onClick={logout}>Log out</Button>
        </div>
      </header>

      {error && <Notice tone="error">{error}</Notice>}
      {me?.wallet && me.wallet.signerStatus !== "GRANTED" && (
        <Notice tone="warn">
          Auctra doesn&apos;t have permission to send from your wallet, so automations won&apos;t run.{" "}
          <Link className="underline" href="/onboarding">Grant permission</Link>
        </Notice>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <Card title="Balance">
          <div className="text-3xl font-semibold">{balance ? `${balance.usdc} USDC` : "—"}</div>
          <div className="mt-1 text-sm text-slate">{balance ? `${balance.mon} MON for gas` : "Balance unavailable"}</div>
          {me?.wallet && (
            <div className="mt-3 text-slate">
              <Mono>{me.wallet.address}</Mono>
            </div>
          )}
        </Card>
        <CreateAutomation onCreated={refresh} />
      </div>

      <AutomationsCard automations={automations} onChanged={refresh} />

      <Card title="Destinations">
        <ul className="mb-5 divide-y divide-white/5">
          {destinations.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <span className="font-medium">{d.label}</span>
                <span className="ml-2 text-xs text-slate">{d.category.toLowerCase()}</span>
                <div className="text-slate"><Mono>{d.address}</Mono></div>
              </div>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm(`Remove ${d.label}? Automations paying it will be cancelled.`)) return;
                  await request(`/api/destinations/${d.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
                  refresh();
                }}
              >
                Remove
              </Button>
            </li>
          ))}
          {destinations.length === 0 && <li className="py-2 text-sm text-slate">No saved destinations.</li>}
        </ul>
        <AddDestination onSaved={refresh} defaultCategory={me?.account?.type === "BUSINESS" ? "VENDOR" : "SAVINGS"} />
      </Card>

      <Card
        title="Execution history"
        actions={
          <Button variant="secondary" onClick={() => download("/api/executions?format=csv", "auctra-executions.csv").catch((e) => setError(e.message))}>
            Export CSV
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate">
              <tr>
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">To</th>
                <th className="py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {executions.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-4 whitespace-nowrap">{when(e.createdAt, me?.user?.timezone)}</td>
                  <td className={`py-2 pr-4 font-mono text-xs ${STATUS_TONE[e.status] ?? ""}`}>{e.status}{e.trigger === "MANUAL" ? " · run now" : ""}</td>
                  <td className="py-2 pr-4">{Number(e.amount)} USDC</td>
                  <td className="py-2 pr-4">{e.destination.label}{e.memo ? <span className="text-slate"> · {e.memo}</span> : null}</td>
                  <td className="py-2">
                    {e.explorerUrl ? (
                      <a className="font-mono text-xs text-signal underline" href={e.explorerUrl} target="_blank" rel="noreferrer">{e.txHash!.slice(0, 12)}…</a>
                    ) : (
                      <span className="text-xs text-slate">{e.errorMessage ?? e.errorCode ?? ""}</span>
                    )}
                  </td>
                </tr>
              ))}
              {executions.length === 0 && (
                <tr><td colSpan={5} className="py-3 text-slate">No executions yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {me && <SettingsCard me={me} onChanged={refresh} />}
    </main>
  );
}

function CreateAutomation({ onCreated }: { onCreated: () => void }) {
  const { request } = useApi();
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<PrepareResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function prepare(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await request<PrepareResponse>("/api/ai/intent", { method: "POST", body: { message } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAutomation(confirmationId: string) {
    setBusy(true);
    try {
      await request("/api/automations", { method: "POST", body: { confirmationId } });
      setResult(null);
      setMessage("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="New automation">
      {result?.kind === "confirm" ? (
        <div className="space-y-3">
          <pre className="whitespace-pre-wrap rounded-[8px] bg-surface-2 p-3 font-sans text-sm">{result.summary}</pre>
          <div className="flex gap-2">
            <Button onClick={() => confirmAutomation(result.confirmationId)} disabled={busy}>Confirm</Button>
            <Button variant="secondary" onClick={() => setResult(null)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={prepare} className="space-y-3">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Save 20 USDC to my savings wallet every Friday at 6 PM"
            required
            maxLength={2000}
          />
          {result?.kind === "clarify" && <Notice tone="warn">{result.question} Add it to your request and try again.</Notice>}
          {result?.kind === "unsupported" && <Notice tone="warn">{result.message}</Notice>}
          {result?.kind === "not_a_request" && <Notice>Describe a USDC transfer: amount, saved destination, and when.</Notice>}
          {result?.kind === "needs_destination" && <Notice tone="warn">Save {result.address} as a destination first.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" disabled={busy}>{busy ? "Reading…" : "Review"}</Button>
        </form>
      )}
    </Card>
  );
}

function AutomationsCard({ automations, onChanged }: { automations: Automation[]; onChanged: () => void }) {
  const { request } = useApi();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  async function act(id: string, action: "pause" | "resume" | "cancel") {
    setError(null);
    await request(`/api/automations/${id}`, { method: "PATCH", body: { action } }).catch((e) => setError(e.message));
    onChanged();
  }

  async function runNow(id: string) {
    setError(null);
    setRunning(id);
    try {
      // One request id per click; retries of this same request are idempotent server-side.
      await request(`/api/automations/${id}/run`, { method: "POST", body: { requestId: `web-${crypto.randomUUID()}` } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
      onChanged();
    }
  }

  const visible = automations.filter((a) => a.status === "ACTIVE" || a.status === "PAUSED");
  return (
    <Card title="Automations">
      {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
      <ul className="divide-y divide-white/5">
        {visible.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="text-sm">
              <div>{a.description}</div>
              <div className="mt-1 text-xs text-slate">
                <span className={STATUS_TONE[a.status]}>{a.status}</span>
                {a.status === "ACTIVE" && ` · next ${when(a.nextRunAt, a.timezone)}`} · {a.executionCount} sent
              </div>
            </div>
            <div className="flex gap-2">
              {a.status === "ACTIVE" && (
                <Button onClick={() => runNow(a.id)} disabled={running !== null}>{running === a.id ? "Running…" : "Run now"}</Button>
              )}
              {a.status === "ACTIVE" ? (
                <Button variant="secondary" onClick={() => act(a.id, "pause")}>Pause</Button>
              ) : (
                <Button variant="secondary" onClick={() => act(a.id, "resume")}>Resume</Button>
              )}
              <Button variant="danger" onClick={() => confirm("Cancel this automation?") && act(a.id, "cancel")}>Cancel</Button>
            </div>
          </li>
        ))}
        {visible.length === 0 && <li className="py-2 text-sm text-slate">No automations. Describe one above or in Telegram.</li>}
      </ul>
    </Card>
  );
}

function SettingsCard({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const { request } = useApi();
  const { removeSigners } = useSigners();
  const [timezone, setTimezone] = useState(me.user?.timezone ?? "UTC");
  const [floor, setFloor] = useState(me.wallet?.balanceFloor ? String(Number(me.wallet.balanceFloor)) : "");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      await request("/api/settings", { method: "PATCH", body: { timezone, balanceFloor: floor.trim() === "" ? null : floor.trim() } });
      setNotice({ tone: "success", text: "Settings saved. New automations use the new timezone." });
      onChanged();
    } catch (e) {
      setNotice({ tone: "error", text: (e as Error).message });
    }
  }

  async function revoke() {
    if (!me.wallet || !confirm("Revoke Auctra's permission? All automations will stop sending.")) return;
    try {
      await removeSigners({ address: me.wallet.address });
      await request("/api/onboarding/signer", { method: "POST", body: { action: "revoked" } });
      setNotice({ tone: "success", text: "Permission revoked." });
      onChanged();
    } catch (e) {
      setNotice({ tone: "error", text: (e as Error).message });
    }
  }

  return (
    <Card title="Settings & security">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label>
          <Label>Timezone</Label>
          <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </label>
        <label>
          <Label>Balance floor (USDC): never send below this</Label>
          <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. 300" inputMode="decimal" />
        </label>
        <Button type="submit">Save</Button>
      </form>
      <div className="mt-5 space-y-2 text-sm text-slate">
        <p>
          Limits: {me.limits.maxTransferUsdc} USDC per transfer, {me.limits.dailyCapUsdc} USDC per 24 hours. Auctra never asks for or stores
          your private key or seed phrase.
        </p>
        {me.wallet?.signerStatus === "GRANTED" && (
          <Button variant="danger" onClick={revoke}>Revoke Auctra&apos;s permission</Button>
        )}
      </div>
      {notice && <div className="mt-3"><Notice tone={notice.tone}>{notice.text}</Notice></div>}
    </Card>
  );
}
