"use client";

import { useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { friendlyError, useApi, type Destination } from "@/lib/client/api";
import { categoryLabel } from "@/lib/client/format";

const CATEGORIES = ["SAVINGS", "PERSONAL", "VENDOR", "CONTRACTOR", "EMPLOYEE", "TREASURY", "OTHER"] as const;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

type Proposal = { confirmationId: string; proposal: { label: string; address: string; category: string } };

/**
 * Saving a destination is two steps: fill in, then confirm the exact address
 * (PRD §6 step 4). Nothing is stored until the second step.
 */
export function DestinationForm({
  defaultCategory = "SAVINGS",
  defaultAddress = "",
  onSaved,
  onCancel
}: {
  defaultCategory?: string;
  defaultAddress?: string;
  onSaved: (destination: Destination) => void;
  onCancel?: () => void;
}) {
  const { request } = useApi();
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState(defaultAddress);
  const [category, setCategory] = useState(defaultCategory);
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState<Proposal | null>(null);
  const [error, setError] = useState<{ title: string; description: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const labelError = touched && !label.trim() ? "Give this destination a name you'll recognise." : null;
  const addressError =
    touched && !ADDRESS.test(address.trim()) ? "Enter a full wallet address: 0x followed by 40 letters or numbers." : null;

  async function review(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!label.trim() || !ADDRESS.test(address.trim())) return;
    setBusy(true);
    setError(null);
    try {
      setPending(await request<Proposal>("/api/destinations", { method: "POST", body: { label: label.trim(), address: address.trim(), category } }));
    } catch (e) {
      setError(friendlyError(e, "Couldn't check this destination"));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const { destination } = await request<{ destination: Destination }>("/api/destinations/confirm", {
        method: "POST",
        body: { confirmationId: pending.confirmationId }
      });
      onSaved(destination);
    } catch (e) {
      setError(friendlyError(e, "Couldn't save this destination"));
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-1">
          <p className="text-h3">Check the address</p>
          <p className="text-secondary">Transfers can&apos;t be undone. Double-check the address.</p>
        </div>
        <dl className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-cloud/60 p-4 text-sm">
          <div className="grid gap-0.5">
            <dt className="text-slate">Name</dt>
            <dd className="m-0 font-medium">{pending.proposal.label}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-slate">Category</dt>
            <dd className="m-0">{categoryLabel(pending.proposal.category)}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-slate">Wallet address</dt>
            <dd className="text-data m-0 break-all text-ink">{pending.proposal.address}</dd>
          </div>
        </dl>
        {error && <Notice tone="danger" title={error.title}>{error.description}</Notice>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>
            Back
          </Button>
          <Button onClick={save} loading={busy} loadingLabel="Saving…">
            Save destination
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={review} noValidate className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={labelError} hint="For example: Savings wallet, Acme Hosting">
          {(p) => <Input {...p} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={64} autoComplete="off" />}
        </Field>
        <Field label="Category">
          {(p) => (
            <Select {...p} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Wallet address" error={addressError}>
        {(p) => (
          <Input
            {...p}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…"
            className="text-data"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
          />
        )}
      </Field>
      {error && <Notice tone="danger" title={error.title}>{error.description}</Notice>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={busy} loadingLabel="Checking…">
          Review destination
        </Button>
      </div>
    </form>
  );
}
