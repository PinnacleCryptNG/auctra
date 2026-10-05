"use client";

import { usePrivy, useSigners } from "@privy-io/react-auth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AddDestination } from "@/components/add-destination";
import { Button, Card, Input, Label, Mono, Notice, TestnetBadge } from "@/components/ui";
import { useApi, type Destination, type Me } from "@/lib/client/api";

// PRD §6 step 2: the web step opened from Telegram. Login → link → account
// (individual or business) → wallet → first destination → grant Auctra's signer.

export default function OnboardingPage() {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return (
      <Shell>
        <Notice tone="warn">Privy is not configured (NEXT_PUBLIC_PRIVY_APP_ID).</Notice>
      </Shell>
    );
  }
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <span className="font-mono text-sm uppercase tracking-[0.2em] text-signal">Auctra</span>
        <TestnetBadge />
      </header>
      {children}
    </main>
  );
}

function Onboarding() {
  const { ready, authenticated, login } = usePrivy();
  const { request } = useApi();
  const token = useSearchParams().get("token");
  const [me, setMe] = useState<Me | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [error, setError] = useState<string | null>(null);
  const linkAttempted = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await request<Me>("/api/me");
      setMe(next);
      if (next.wallet) setDestinations((await request<{ destinations: Destination[] }>("/api/destinations")).destinations);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    (async () => {
      if (token && !linkAttempted.current) {
        linkAttempted.current = true;
        try {
          await request("/api/onboarding/link", { method: "POST", body: { token } });
        } catch (e) {
          setError((e as Error).message);
        }
      }
      await refresh();
    })();
  }, [ready, authenticated, token, request, refresh]);

  if (!ready) return <Shell><p className="text-slate">Loading…</p></Shell>;

  if (!authenticated) {
    return (
      <Shell>
        <Card>
          <h1 className="mb-2 text-2xl font-semibold">Set up Auctra</h1>
          <p className="mb-4 text-sm text-slate">
            Log in to create your Monad Testnet wallet. Auctra never asks for a seed phrase or private key.
          </p>
          <Button onClick={login}>Log in</Button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      {error && <Notice tone="error">{error}</Notice>}
      {!me ? (
        <p className="text-slate">Loading your account…</p>
      ) : !me.linked ? (
        <Card title="Link Telegram">
          <p className="text-sm">Open the Auctra bot in Telegram and send /start. Then use the setup button it sends you.</p>
        </Card>
      ) : !me.account ? (
        <AccountStep onDone={refresh} />
      ) : !me.wallet ? (
        <WalletStep onDone={refresh} />
      ) : destinations.length === 0 ? (
        <Card title="Step 3 · Save your first destination">
          <p className="mb-4 text-sm text-slate">
            Auctra only sends to destinations you have saved and confirmed, like a savings wallet or a vendor.
          </p>
          <AddDestination onSaved={refresh} defaultCategory={me.account.type === "BUSINESS" ? "VENDOR" : "SAVINGS"} />
        </Card>
      ) : me.wallet.signerStatus !== "GRANTED" ? (
        <SignerStep me={me} destinations={destinations} onDone={refresh} />
      ) : (
        <Card>
          <h1 className="mb-2 text-2xl font-semibold">You&apos;re set up</h1>
          <p className="mb-4 text-sm text-slate">
            Fund your wallet <Mono>{me.wallet.address}</Mono> with testnet MON (for gas) and testnet USDC, then go back to Telegram and
            tell Auctra what you want your money to do.
          </p>
          <Link href="/dashboard" className="text-sm text-signal underline">Open the dashboard</Link>
        </Card>
      )}
    </Shell>
  );
}

function AccountStep({ onDone }: { onDone: () => void }) {
  const { request } = useApi();
  const [type, setType] = useState<"INDIVIDUAL" | "BUSINESS">("INDIVIDUAL");
  const [businessName, setBusinessName] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request("/api/onboarding/account", {
        method: "POST",
        body: { type, timezone, ...(type === "BUSINESS" ? { businessName } : {}) }
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Step 1 · Your account">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["INDIVIDUAL", "BUSINESS"] as const).map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => setType(option)}
              className={`rounded-[12px] border p-4 text-left ${type === option ? "border-signal" : "border-white/15"}`}
            >
              <div className="font-medium">{option === "INDIVIDUAL" ? "Personal" : "Business"}</div>
              <div className="mt-1 text-xs text-slate">
                {option === "INDIVIDUAL" ? "Savings, recurring payments, balance protection." : "Vendor and contractor payments, reserve sweeps, operating floor."}
              </div>
            </button>
          ))}
        </div>
        {type === "BUSINESS" && (
          <label className="block">
            <Label>Business name</Label>
            <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required maxLength={120} />
          </label>
        )}
        <label className="block">
          <Label>Timezone (schedules run in this timezone)</Label>
          <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" disabled={busy}>Continue</Button>
      </form>
    </Card>
  );
}

function WalletStep({ onDone }: { onDone: () => void }) {
  const { request } = useApi();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      await request("/api/onboarding/wallet", { method: "POST" });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Step 2 · Your wallet">
      <p className="mb-4 text-sm text-slate">
        Privy created an embedded wallet for you when you logged in. You own it; Auctra never sees its keys. Connect it to Auctra as
        your execution wallet on Monad Testnet.
      </p>
      {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
      <Button onClick={register} disabled={busy}>Use this wallet</Button>
    </Card>
  );
}

function SignerStep({ me, destinations, onDone }: { me: Me; destinations: Destination[]; onDone: () => void }) {
  const { request } = useApi();
  const { addSigners } = useSigners();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function grant() {
    setBusy(true);
    setError(null);
    try {
      const signer = await request<{ address: string; signerId: string; policyId: string }>("/api/onboarding/signer");
      await addSigners({ address: signer.address, signers: [{ signerId: signer.signerId, policyIds: [signer.policyId] }] });
      await request("/api/onboarding/signer", { method: "POST", body: { action: "granted" } });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Step 4 · Allow Auctra to send scheduled transfers">
      <div className="space-y-3 text-sm">
        <p>You are giving Auctra limited signing permission on your wallet so it can run the automations you confirm. It can:</p>
        <ul className="list-disc space-y-1 pl-5 text-slate">
          <li>send only USDC, only on Monad Testnet;</li>
          <li>send only to your saved destinations ({destinations.map((d) => d.label).join(", ")});</li>
          <li>send at most {me.limits.maxTransferUsdc} USDC per transfer and {me.limits.dailyCapUsdc} USDC per 24 hours;</li>
          <li>only run automations you confirmed.</li>
        </ul>
        <p className="text-slate">
          Privy enforces these limits too, not just Auctra. You can revoke this permission at any time in Settings; every automation
          then stops.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <Button onClick={grant} disabled={busy}>Grant permission</Button>
      </div>
    </Card>
  );
}

