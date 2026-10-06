"use client";

import { useCreateWallet, usePrivy, useSigners, useWallets } from "@privy-io/react-auth";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DestinationForm } from "@/components/auctra/destination-form";
import { StatusScreen } from "@/components/auctra/status-screen";
import { Logo } from "@/components/auctra/logo";
import {
  Address,
  Button,
  ButtonLink,
  Card,
  ErrorState,
  Field,
  IconCheck,
  IconShield,
  Input,
  LoadingState,
  Notice,
  TestnetBadge
} from "@/components/ui";
import { friendlyError, useApi, type Destination, type Me } from "@/lib/client/api";
import { formatUsdc } from "@/lib/client/format";

// PRD §6 step 2: the web step opened from Telegram. Login → link → account
// (individual or business) → wallet → first destination → grant Auctra's signer.

const STEPS = ["Account", "Wallet", "Destination", "Permission"] as const;

export default function OnboardingPage() {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return (
      <StatusScreen>
        <ErrorState title="Sign-in isn't configured" description="This deployment is missing its Privy app ID, so setup can't start." />
      </StatusScreen>
    );
  }
  return (
    <Suspense fallback={<StatusScreen><LoadingState label="Opening setup…" rows={0} /></StatusScreen>}>
      <Onboarding />
    </Suspense>
  );
}

function Shell({ step, children }: { step: number | null; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <Logo />
        <TestnetBadge />
      </header>
      <main id="main" className="mx-auto grid w-full max-w-xl gap-6 px-4 py-8 sm:py-12">
        {step !== null && (
          <nav aria-label="Setup progress">
            <ol className="grid grid-cols-4 gap-2">
              {STEPS.map((label, index) => {
                const state = index < step ? "done" : index === step ? "current" : "todo";
                return (
                  <li key={label} aria-current={state === "current" ? "step" : undefined} className="grid gap-2">
                    <span className={`h-1 rounded-full ${state === "todo" ? "bg-line" : "bg-signal"}`} />
                    <span className={`flex items-center gap-1 text-xs ${state === "todo" ? "text-slate" : "font-medium text-ink"}`}>
                      {state === "done" && <IconCheck className="text-signal-ink" />}
                      <span className="truncate">{label}</span>
                      <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (current step)" : ""}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        <div className="animate-enter">{children}</div>
      </main>
    </div>
  );
}

function StepCard({ index, title, description, children }: { index: number; title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-7">
      <p className="text-meta">
        Step {index + 1} of {STEPS.length}
      </p>
      <h1 className="mt-1 text-h1">{title}</h1>
      <div className="mt-2 text-secondary">{description}</div>
      <div className="mt-6">{children}</div>
    </Card>
  );
}

function Onboarding() {
  const { ready, authenticated, login } = usePrivy();
  const { request } = useApi();
  const token = useSearchParams().get("token");
  const [me, setMe] = useState<Me | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const linkAttempted = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await request<Me>("/api/me");
      setMe(next);
      if (next.wallet) setDestinations((await request<{ destinations: Destination[] }>("/api/destinations")).destinations);
    } catch (e) {
      setError(friendlyError(e, "Couldn't load your setup"));
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
          setError(friendlyError(e, "This setup link didn't work"));
        }
      }
      // Make sure this Privy login has an Auctra user record (idempotent).
      try {
        await request("/api/auth/session", { method: "POST" });
      } catch (e) {
        setError(friendlyError(e, "Couldn't start your setup"));
        return;
      }
      await refresh();
    })();
  }, [ready, authenticated, token, request, refresh]);

  if (!ready) {
    return (
      <Shell step={null}>
        <LoadingState label="Connecting to Auctra…" rows={0} />
      </Shell>
    );
  }

  if (!authenticated) {
    return (
      <Shell step={null}>
        <Card className="p-5 sm:p-7">
          <h1 className="text-h1">Set up Auctra</h1>
          <p className="mt-2 text-secondary">
            Sign in to create your Auctra Wallet on Monad Testnet. You own the wallet. Auctra never asks for a seed phrase or private key.
          </p>
          <Button size="lg" className="mt-6 w-full" onClick={login}>
            Sign in
          </Button>
        </Card>
      </Shell>
    );
  }

  const step = !me?.account ? 0 : !me.wallet ? 1 : destinations.length === 0 ? 2 : me.wallet.signerStatus !== "GRANTED" ? 3 : 4;

  return (
    <Shell step={me?.linked && step < 4 ? step : null}>
      <div className="grid gap-4">
        {error && <Notice tone="danger" title={error.title}>{error.description}</Notice>}
        {!me ? (
          <LoadingState label="Loading your setup…" rows={0} />
        ) : !me.linked ? (
          <Card className="p-5 sm:p-7">
            <h1 className="text-h1">Setup couldn&apos;t start</h1>
            <p className="mt-2 text-secondary">Sign out and sign in again. If it keeps happening, try again later.</p>
          </Card>
        ) : step === 0 ? (
          <AccountStep onDone={refresh} />
        ) : step === 1 ? (
          <WalletStep onDone={refresh} />
        ) : step === 2 ? (
          <StepCard
            index={2}
            title="Save your first destination"
            description="Auctra only sends to wallets you've saved and confirmed, like a savings wallet or a vendor."
          >
            <DestinationForm defaultCategory={me.account?.type === "BUSINESS" ? "VENDOR" : "SAVINGS"} onSaved={refresh} />
          </StepCard>
        ) : step === 3 ? (
          <PermissionStep me={me} destinations={destinations} onDone={refresh} />
        ) : (
          <DoneStep me={me} />
        )}
      </div>
    </Shell>
  );
}

function AccountStep({ onDone }: { onDone: () => void }) {
  const { request } = useApi();
  const [type, setType] = useState<"INDIVIDUAL" | "BUSINESS">("INDIVIDUAL");
  const [businessName, setBusinessName] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const nameError = touched && type === "BUSINESS" && !businessName.trim() ? "Enter your business name." : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (type === "BUSINESS" && !businessName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await request("/api/onboarding/account", {
        method: "POST",
        body: { type, timezone, ...(type === "BUSINESS" ? { businessName: businessName.trim() } : {}) }
      });
      onDone();
    } catch (e) {
      setError(friendlyError(e, "Your account wasn't created"));
    } finally {
      setBusy(false);
    }
  }

  const options = [
    { value: "INDIVIDUAL" as const, title: "Personal", text: "Savings, recurring payments and balance protection." },
    { value: "BUSINESS" as const, title: "Business", text: "Vendor and contractor payments, reserve sweeps, operating floor." }
  ];

  return (
    <StepCard index={0} title="Who is Auctra working for?" description="You can't change this later, so pick the one that fits.">
      <form onSubmit={submit} noValidate className="grid gap-5">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Account type</legend>
          {options.map((option) => (
            <label
              key={option.value}
              className={`relative grid cursor-pointer gap-1 rounded-[var(--radius-card)] border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-obsidian ${
                type === option.value ? "border-obsidian bg-cloud/60" : "border-line hover:border-slate/50"
              }`}
            >
              <input
                type="radio"
                name="account-type"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="text-h3">{option.title}</span>
                <span
                  aria-hidden="true"
                  className={`grid size-5 place-items-center rounded-full border ${type === option.value ? "border-obsidian bg-obsidian text-cloud" : "border-line"}`}
                >
                  {type === option.value && <IconCheck className="text-xs" />}
                </span>
              </span>
              <span className="text-sm text-slate">{option.text}</span>
            </label>
          ))}
        </fieldset>
        {type === "BUSINESS" && (
          <Field label="Business name" error={nameError}>
            {(p) => <Input {...p} value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={120} autoComplete="organization" />}
          </Field>
        )}
        <Field label="Timezone" hint="Your schedules run at local times in this timezone.">
          {(p) => <Input {...p} value={timezone} onChange={(e) => setTimezone(e.target.value)} autoComplete="off" spellCheck={false} />}
        </Field>
        {error && <Notice tone="danger" title={error.title}>{error.description}</Notice>}
        <Button type="submit" size="lg" loading={busy} loadingLabel="Creating your account…" className="w-full sm:w-auto sm:justify-self-start">
          Continue
        </Button>
      </form>
    </StepCard>
  );
}

/**
 * Uses Privy's own state for the embedded wallet: wait until Privy has loaded
 * wallets, create the embedded wallet if Privy didn't on login, then let the
 * server look it up by the verified user and store its safe metadata.
 */
function WalletStep({ onDone }: { onDone: () => void }) {
  const { request } = useApi();
  const { ready: walletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const [busy, setBusy] = useState<null | "create" | "connect">(null);
  const embedded = wallets.find((w) => w.walletClientType === "privy");

  async function create() {
    setBusy("create");
    setError(null);
    try {
      await createWallet();
    } catch {
      // Privy's own error text is never shown to the user.
      setError({ title: "Your wallet couldn't be created", description: "Try again in a moment." });
    } finally {
      setBusy(null);
    }
  }

  async function connect() {
    setBusy("connect");
    setError(null);
    try {
      await request("/api/onboarding/wallet", { method: "POST" });
      onDone();
    } catch (e) {
      setError(friendlyError(e, "Your wallet isn't connected yet"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <StepCard
      index={1}
      title="Connect your Auctra Wallet"
      description="Your Auctra Wallet is created and secured by Privy. You own it, and Auctra never sees its keys. Connect it so your automations can send from it on Monad Testnet."
    >
      <div className="grid gap-4">
        {!walletsReady ? (
          <LoadingState label="Checking for your wallet…" rows={0} />
        ) : embedded ? (
          <div className="grid gap-1 rounded-[var(--radius-card)] border border-line bg-cloud/60 p-4">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-h3">Auctra Wallet</span>
              <TestnetBadge />
            </span>
            <Address value={embedded.address} label="Wallet address" />
          </div>
        ) : (
          <p className="text-sm text-ink-2">No wallet yet. Create one now; it takes a few seconds and needs no seed phrase.</p>
        )}
        {error && <Notice tone="danger" title={error.title}>{error.description}</Notice>}
        {walletsReady &&
          (embedded ? (
            <Button size="lg" onClick={connect} loading={busy === "connect"} loadingLabel="Connecting wallet…" className="w-full sm:w-auto sm:justify-self-start">
              Connect wallet
            </Button>
          ) : (
            <Button size="lg" onClick={create} loading={busy === "create"} loadingLabel="Creating your wallet…" className="w-full sm:w-auto sm:justify-self-start">
              Create wallet
            </Button>
          ))}
      </div>
    </StepCard>
  );
}

function PermissionStep({ me, destinations, onDone }: { me: Me; destinations: Destination[]; onDone: () => void }) {
  const { request } = useApi();
  const { addSigners } = useSigners();
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
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
      setError(friendlyError(e, "Permission wasn't granted"));
    } finally {
      setBusy(false);
    }
  }

  const limits = [
    "Send USDC only, on Monad Testnet only",
    `Send only to your saved destinations (${destinations.map((d) => d.label).join(", ")})`,
    `At most ${formatUsdc(me.limits.maxTransferUsdc)} USDC per transfer and ${formatUsdc(me.limits.dailyCapUsdc)} USDC per 24 hours`,
    "Only run automations you've confirmed"
  ];

  return (
    <StepCard
      index={3}
      title="Allow Auctra to send scheduled transfers"
      description="You're giving Auctra limited permission on your wallet so it can run the automations you confirm."
    >
      <div className="grid gap-5">
        <ul className="grid gap-2.5">
          {limits.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[0.9375rem]">
              <IconCheck className="mt-1 shrink-0 text-signal-ink" />
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-cloud/60 p-4 text-sm text-ink-2">
          <IconShield className="mt-0.5 shrink-0 text-lg text-slate" />
          <p>Your wallet provider enforces these limits too, not just Auctra. You can revoke this permission at any time in Settings, and every automation stops.</p>
        </div>
        {error && <Notice tone="danger" title={error.title}>{error.description}</Notice>}
        <Button size="lg" onClick={grant} loading={busy} loadingLabel="Waiting for your wallet…" className="w-full sm:w-auto sm:justify-self-start">
          Grant permission
        </Button>
      </div>
    </StepCard>
  );
}

function DoneStep({ me }: { me: Me }) {
  return (
    <Card className="p-5 sm:p-7">
      <span className="grid size-12 place-items-center rounded-full bg-signal-soft text-2xl text-signal-ink">
        <IconCheck />
      </span>
      <h1 className="mt-4 text-h1">You&apos;re set up</h1>
      <p className="mt-2 text-secondary">
        Add testnet MON (for network fees) and testnet USDC to your wallet, then go back to Telegram and tell Auctra what you want your money to do.
      </p>
      {me.wallet && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-line bg-cloud/60 p-4">
          <p className="text-sm text-slate">Your Auctra Wallet</p>
          <Address value={me.wallet.address} label="Wallet address" full />
        </div>
      )}
      <ButtonLink href="/dashboard" size="lg" className="mt-6 w-full sm:w-auto">
        Open dashboard
      </ButtonLink>
    </Card>
  );
}
