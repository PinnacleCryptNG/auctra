"use client";

import { usePrivy, useSigners } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/auctra/app-shell";
import { DestinationForm } from "@/components/auctra/destination-form";
import { Resource } from "@/components/auctra/resource";
import {
  Address,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconLogout,
  IconPlus,
  IconShield,
  IconWallet,
  Input,
  Notice,
  TestnetBadge
} from "@/components/ui";
import { friendlyError, useApi, type Destination } from "@/lib/client/api";
import { useAuctra } from "@/lib/client/auctra-data";
import { categoryLabel, formatUsdc } from "@/lib/client/format";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your wallet, who Auctra can pay, and your safety limits." />
      <div className="grid gap-6">
        <WalletSection />
        <DestinationsSection />
        <PreferencesSection />
        <AccountSection />
      </div>
    </>
  );
}

function WalletSection() {
  const { me, refresh } = useAuctra();
  const { request } = useApi();
  const { removeSigners } = useSigners();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const data = me.data!;
  const wallet = data.wallet!;
  const granted = wallet.signerStatus === "GRANTED";

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await removeSigners({ address: wallet.address });
      await request("/api/onboarding/signer", { method: "POST", body: { action: "revoked" } });
      await refresh(["me"]);
      setConfirming(false);
    } catch (e) {
      setError(friendlyError(e, "Permission wasn't revoked"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby="wallet-heading">
      <CardHeader id="wallet-heading" title="Auctra Wallet" description="The wallet your automations send from. You own it; Auctra never sees its keys." />
      <CardBody>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Wallet">
            <Badge tone="success" icon={<IconShield />}>Connected</Badge>
          </Detail>
          <Detail label="Automations">
            {granted ? <Badge tone="success">Can run automations</Badge> : <Badge tone="warning">Permission needed</Badge>}
          </Detail>
          <Detail label="Network">
            <span className="inline-flex flex-wrap items-center gap-2">
              Monad Testnet <TestnetBadge compact />
            </span>
          </Detail>
          <Detail label="Address" wide>
            <Address value={wallet.address} label="Wallet address" full />
          </Detail>
        </dl>

        <div className="mt-5 grid gap-3 rounded-[var(--radius-card)] border border-line bg-cloud/60 p-4">
          <div className="flex items-start gap-3">
            <IconWallet className="mt-0.5 shrink-0 text-lg text-slate" />
            <div className="grid gap-1 text-sm">
              <p className="font-medium">What Auctra is allowed to do</p>
              <ul className="list-disc space-y-0.5 pl-4 text-ink-2">
                <li>Send USDC only, on Monad Testnet only</li>
                <li>Send only to your saved destinations</li>
                <li>
                  At most {formatUsdc(data.limits.maxTransferUsdc)} USDC per transfer and {formatUsdc(data.limits.dailyCapUsdc)} USDC per 24
                  hours
                </li>
              </ul>
            </div>
          </div>
          {error && <Notice tone="danger" title={error.title}>{error.description}</Notice>}
          <div className="flex flex-wrap gap-2">
            {granted ? (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Revoke permission
              </Button>
            ) : (
              <ButtonLink href="/onboarding">Grant permission</ButtonLink>
            )}
          </div>
        </div>
      </CardBody>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Revoke Auctra's permission?"
        description="Every automation stops sending until you grant permission again. Your automations and history are kept."
        confirmLabel="Revoke permission"
        busy={busy}
        onConfirm={revoke}
      />
    </Card>
  );
}

function DestinationsSection() {
  const { me, destinations, refresh } = useAuctra();
  const { request } = useApi();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Destination | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const business = me.data?.account?.type === "BUSINESS";

  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/api/destinations/${removing.id}`, { method: "DELETE" });
      await refresh(["destinations", "automations"]);
      setRemoving(null);
    } catch (e) {
      setError(friendlyError(e, "The destination wasn't removed"));
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby="destinations-heading">
      <CardHeader
        id="destinations-heading"
        title="Saved destinations"
        description="Auctra can only send to wallets on this list."
        actions={
          <Button variant="secondary" size="sm" icon={<IconPlus />} onClick={() => setAdding(true)}>
            Add destination
          </Button>
        }
      />
      <div className="mt-4 border-t border-line">
        {error && (
          <div className="px-4 pt-4 sm:px-5">
            <Notice tone="danger" title={error.title}>{error.description}</Notice>
          </div>
        )}
        <Resource
          data={destinations.data}
          loading={destinations.loading}
          error={destinations.error}
          loadingLabel="Loading your destinations…"
          errorTitle="Couldn't load your destinations"
          onRetry={() => refresh(["destinations"])}
          empty={<EmptyState title="No saved destinations" description="Add a wallet you want Auctra to pay, like a savings wallet or a vendor." />}
        >
          {(items) => (
            <ul className="divide-y divide-line">
              {items.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{d.label}</span>
                      <Badge>{categoryLabel(d.category)}</Badge>
                    </span>
                    <Address value={d.address} label={`${d.label} address`} />
                  </div>
                  <Button variant="danger-ghost" size="sm" onClick={() => setRemoving(d)}>
                    Remove<span className="sr-only"> {d.label}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Resource>
      </div>

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add destination" description="Name the wallet and check the address before saving.">
        {adding && (
          <DestinationForm
            defaultCategory={business ? "VENDOR" : "SAVINGS"}
            onCancel={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              refresh(["destinations"]);
            }}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.label ?? "this destination"}?`}
        description="Automations that pay this destination will be cancelled. Past transfers stay in your activity."
        confirmLabel="Remove destination"
        busy={busy}
        onConfirm={remove}
      />
    </Card>
  );
}

function PreferencesSection() {
  const { me, refresh } = useAuctra();
  const { request } = useApi();
  const data = me.data!;
  const [timezone, setTimezone] = useState(data.user?.timezone ?? "UTC");
  const [floor, setFloor] = useState(data.wallet?.balanceFloor ? formatUsdc(data.wallet.balanceFloor).replace(/,/g, "") : "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; title: string; text?: string } | null>(null);
  const [floorError, setFloorError] = useState<string | null>(null);
  const [zones, setZones] = useState<string[]>([]);

  useEffect(() => {
    try {
      setZones((Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []);
    } catch {
      setZones([]);
    }
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = floor.trim();
    if (trimmed && !/^\d+(\.\d{1,6})?$/.test(trimmed)) {
      setFloorError("Enter an amount in USDC, like 300 or 300.50.");
      return;
    }
    setFloorError(null);
    setBusy(true);
    setNotice(null);
    try {
      await request("/api/settings", { method: "PATCH", body: { timezone, balanceFloor: trimmed === "" ? null : trimmed } });
      await refresh(["me"]);
      setNotice({ tone: "success", title: "Settings saved", text: "New automations use this timezone." });
    } catch (e) {
      const { title, description } = friendlyError(e, "Settings weren't saved");
      setNotice({ tone: "danger", title, text: description });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby="prefs-heading">
      <CardHeader id="prefs-heading" title="Safety and schedule" />
      <CardBody>
        <form onSubmit={save} noValidate className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Balance floor (USDC)" hint="Auctra skips any transfer that would leave less than this. Leave empty for no floor." error={floorError}>
              {(p) => <Input {...p} value={floor} onChange={(e) => setFloor(e.target.value)} inputMode="decimal" placeholder="e.g. 300" autoComplete="off" />}
            </Field>
            <Field label="Timezone" hint="Schedules run at local times in this timezone.">
              {(p) => (
                <>
                  <Input {...p} value={timezone} onChange={(e) => setTimezone(e.target.value)} list="timezones" autoComplete="off" spellCheck={false} />
                  <datalist id="timezones">
                    {zones.map((z) => (
                      <option key={z} value={z} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
          </div>
          {notice && <Notice tone={notice.tone} title={notice.title}>{notice.text}</Notice>}
          <div>
            <Button type="submit" loading={busy} loadingLabel="Saving…">
              Save changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function AccountSection() {
  const { me } = useAuctra();
  const { logout } = usePrivy();
  const account = me.data!.account!;
  return (
    <Card aria-labelledby="account-heading">
      <CardHeader id="account-heading" title="Account" />
      <CardBody>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Name">{account.type === "BUSINESS" ? account.businessName : "Personal account"}</Detail>
          <Detail label="Type">{account.type === "BUSINESS" ? "Business" : "Personal"}</Detail>
        </dl>
        <div className="mt-5">
          <Button variant="secondary" icon={<IconLogout />} onClick={logout}>
            Sign out
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Detail({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`grid min-w-0 gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-sm text-slate">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </div>
  );
}
