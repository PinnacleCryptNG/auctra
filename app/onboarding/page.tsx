"use client";

import { useCreateWallet, usePrivy, useSigners, useWallets } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
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
  IconArrowLeft,
  IconCheck,
  IconShield,
  Input,
  LoadingState,
  Notice
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

function Shell({ step, reached = step, onBack, children }: { step: number | null; reached?: number | null; onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-ledger min-h-dvh">
      <header className="flex items-center gap-1 border-b border-line bg-cloud/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <BackButton onBack={onBack} />
        <Logo />
      </header>
      <main id="main" className="mx-auto grid w-full max-w-xl gap-6 px-4 py-8 sm:py-12">
        {step !== null && (
          <nav aria-label="Setup progress">
            <ol className="grid grid-cols-4 gap-2">
              {STEPS.map((label, index) => {
                const state = index === step ? "current" : index < (reached ?? step) ? "done" : "todo";
                return (
                  <li key={label} aria-current={state === "current" ? "step" : undefined} className="grid gap-2">
                    <span className={`h-1 rounded-full ${state === "todo" ? "bg-line" : state === "current" ? "bg-obsidian" : "bg-signal-strong"}`} />
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

/**
 * Steps back through setup when `onBack` is given; otherwise goes to the
 * previous page, or home when setup was opened directly (e.g. from Telegram).
 */
function BackButton({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (onBack ? onBack() : window.history.length > 1 ? router.back() : router.push("/"))}
      className="-ml-2 grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-lg text-ink hover:bg-slate-soft"
    >
      <IconArrowLeft />
      <span className="sr-only">Back</span>
    </button>
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
  // An earlier, finished step the user stepped back to; null shows the current step.
  const [viewing, setViewing] = useState<number | null>(null);

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
            Sign in to get your wallet. No seed phrase needed.
          </p>
          <Button size="lg" className="mt-6 w-full" onClick={login}>
            Sign in
          </Button>
        </Card>
      </Shell>
    );
  }

  const step = !me?.account ? 0 : !me.wallet ? 1 : destinations.length === 0 ? 2 : me.wallet.permission !== "VERIFIED" ? 3 : 4;
  const inSetup = Boolean(me?.linked) && step < 4;
  const shown = inSetup && viewing !== null && viewing < step ? viewing : step;
  const forward = () => setViewing(shown + 1 < step ? shown + 1 : null);

  return (
    <Shell step={inSetup ? shown : null} reached={inSetup ? step : null} onBack={inSetup && shown > 0 ? () => setViewing(shown - 1) : undefined}>
      <div className="grid gap-4">
        {error && <Notice tone="danger" title={error.title}>{error.description}</Notice>}
        {!me ? (
          <LoadingState label="Loading your setup…" rows={0} />
        ) : !me.linked ? (
          <Card className="p-5 sm:p-7">
            <h1 className="text-h1">Setup couldn&apos;t start</h1>
            <p className="mt-2 text-secondary">Sign out and sign in again. If it keeps happening, try again later.</p>
          </Card>
        ) : shown < step ? (
          <ReviewStep index={shown} me={me} destinations={destinations} onRefresh={refresh} onContinue={forward} />
        ) : step === 0 ? (
          <AccountStep onDone={refresh} />
        ) : step === 1 ? (
          <WalletStep onDone={refresh} />
        ) : step === 2 ? (
          <StepCard
            index={2}
            title="Save your first destination"
            description="Auctra only sends to wallets you save."
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
    { value: "INDIVIDUAL" as const, title: "Personal", text: "Save and pay bills." },
    { value: "BUSINESS" as const, title: "Business", text: "Pay vendors and staff." }
  ];

  return (
    <StepCard index={0} title="Who is Auctra working for?" description="You can't change this later.">
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
        <Field label="Timezone" hint="Schedules run in this timezone.">
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

/** A finished step, shown again when the user steps back. Its choices are already saved. */
function ReviewStep({
  index,
  me,
  destinations,
  onRefresh,
  onContinue
}: {
  index: number;
  me: Me;
  destinations: Destination[];
  onRefresh: () => void;
  onContinue: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const account = me.account;
  return (
    <StepCard
      index={index}
      title={["Your account", "Your Auctra Wallet", "Your destinations", "Permission"][index]}
      description={["This is set and can't be changed.", "You own it. Auctra never sees its keys.", "Auctra only sends to wallets you save.", "Already approved."][index]}
    >
      <div className="grid gap-4">
        {index === 0 && account && (
          <div className="rounded-[var(--radius-card)] border border-line bg-cloud/60 p-4">
            <p className="text-h3">{account.type === "BUSINESS" ? account.businessName ?? "Business" : "Personal"}</p>
            <p className="text-sm text-slate">{account.type === "BUSINESS" ? "Business account" : "Personal account"}</p>
          </div>
        )}
        {index === 1 && me.wallet && (
          <div className="grid gap-1 rounded-[var(--radius-card)] border border-line bg-cloud/60 p-4">
            <span className="text-h3">Auctra Wallet</span>
            <Address value={me.wallet.address} label="Wallet address" />
          </div>
        )}
        {index === 2 && (
          <>
            <ul className="grid gap-2">
              {destinations.map((d) => (
                <li key={d.id} className="grid gap-1 rounded-[var(--radius-card)] border border-line bg-cloud/60 p-4">
                  <span className="text-h3">{d.label}</span>
                  <Address value={d.address} label={`${d.label} address`} />
                </li>
              ))}
            </ul>
            {adding ? (
              <DestinationForm
                defaultCategory={account?.type === "BUSINESS" ? "VENDOR" : "SAVINGS"}
                onCancel={() => setAdding(false)}
                onSaved={() => {
                  setAdding(false);
                  onRefresh();
                }}
              />
            ) : (
              <Button variant="secondary" onClick={() => setAdding(true)} className="w-full sm:w-auto sm:justify-self-start">
                Add another
              </Button>
            )}
          </>
        )}
        {!adding && (
          <Button size="lg" onClick={onContinue} className="w-full sm:w-auto sm:justify-self-start">
            Continue
          </Button>
        )}
      </div>
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
      description="You own it. Auctra never sees its keys."
    >
      <div className="grid gap-4">
        {!walletsReady ? (
          <LoadingState label="Checking for your wallet…" rows={0} />
        ) : embedded ? (
          <div className="grid gap-1 rounded-[var(--radius-card)] border border-line bg-cloud/60 p-4">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-h3">Auctra Wallet</span>
            </span>
            <Address value={embedded.address} label="Wallet address" />
          </div>
        ) : (
          <p className="text-sm text-ink-2">No wallet yet. Create one in seconds.</p>
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

type PermissionReview = {
  address: string;
  signerId: string;
  policyId: string;
  permission: NonNullable<Me["wallet"]>["permission"];
  review: {
    network: string;
    chainId: number;
    asset: string;
    contract: string;
    maxTransferUsdc: string;
    dailyCapUsdc: string;
    recipients: Array<{ label: string; address: string }>;
  };
};

// Lifecycle: review the exact limits → approve in the wallet (Privy addSigners) →
// the server re-reads the wallet and policy from Privy and only then records it.
function PermissionStep({ me, onDone }: { me: Me; destinations: Destination[]; onDone: () => void }) {
  const { request } = useApi();
  const { addSigners, removeSigners } = useSigners();
  const [review, setReview] = useState<PermissionReview | null>(null);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadReview = useCallback(async () => {
    setError(null);
    try {
      setReview(await request<PermissionReview>("/api/onboarding/signer"));
    } catch (e) {
      setError(friendlyError(e, "Auctra's limits couldn't be loaded"));
    }
  }, [request]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  async function approve() {
    if (!review) return;
    setBusy(true);
    setError(null);
    try {
      // A stale grant is still attached with the old limits: remove it first so
      // the wallet ends up with exactly one Auctra signer, bound to the new policy.
      if (me.wallet?.permission === "STALE") await removeSigners({ address: review.address });
      await addSigners({ address: review.address, signers: [{ signerId: review.signerId, policyIds: [review.policyId] }] });
      await request("/api/onboarding/signer", { method: "POST", body: { action: "granted", policyId: review.policyId } });
      onDone();
    } catch (e) {
      setError(friendlyError(e, "Permission wasn't granted"));
    } finally {
      setBusy(false);
    }
  }

  const stale = me.wallet?.permission === "STALE";

  return (
    <StepCard
      index={3}
      title={stale ? "Review Auctra's permission again" : "Allow Auctra to send scheduled transfers"}
      description={
        stale
          ? "Your destinations changed. Approve the new limits to continue."
          : "Auctra can only do this:"
      }
    >
      <div className="grid gap-5">
        {!review && !error && <LoadingState label="Preparing Auctra's limits…" rows={2} />}
        {review && (
          <ul className="grid gap-2.5">
            {[
              `Send ${review.review.asset} only`,
              `Up to ${formatUsdc(review.review.maxTransferUsdc)} USDC per transfer`,
              `Up to ${formatUsdc(review.review.dailyCapUsdc)} USDC per day`
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[0.9375rem]">
                <IconCheck className="mt-1 shrink-0 text-signal-ink" />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
            <li className="flex items-start gap-2.5 text-[0.9375rem]">
              <IconCheck className="mt-1 shrink-0 text-signal-ink" />
              <span className="grid min-w-0 gap-1.5">
                <span>Only to:</span>
                {review.review.recipients.map((r) => (
                  <span key={r.address} className="grid gap-0.5">
                    <span className="text-sm font-medium">{r.label}</span>
                    <Address value={r.address} label={`${r.label} address`} full />
                  </span>
                ))}
              </span>
            </li>
          </ul>
        )}
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-cloud/60 p-4 text-sm text-ink-2">
          <IconShield className="mt-0.5 shrink-0 text-lg text-slate" />
          <p>
            Only you can change these. Revoke anytime in Settings.
          </p>
        </div>
        {error && (
          <Notice
            tone="danger"
            title={error.title}
            action={!review ? <Button size="sm" variant="secondary" onClick={loadReview}>Try again</Button> : undefined}
          >
            {error.description}
          </Notice>
        )}
        <Button
          size="lg"
          onClick={approve}
          disabled={!review}
          loading={busy}
          loadingLabel="Waiting for your wallet…"
          className="w-full sm:w-auto sm:justify-self-start"
        >
          {stale ? "Approve new limits" : "Approve permission"}
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
        Add USDC and a little MON for fees, then tell Auctra what to do.
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
