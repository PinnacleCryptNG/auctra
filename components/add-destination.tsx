"use client";

import { useState } from "react";
import { useApi } from "@/lib/client/api";
import { Button, CATEGORIES, Input, Label, Mono, Notice, Select } from "./ui";

type Proposal = { confirmationId: string; proposal: { label: string; address: string; category: string } };

/** Two-step save: the user must confirm the full address before it's stored (PRD §6 step 4). */
export function AddDestination({ onSaved, defaultCategory = "SAVINGS" }: { onSaved: () => void; defaultCategory?: string }) {
  const { request } = useApi();
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [pending, setPending] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function propose(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      setPending(await request<Proposal>("/api/destinations", { method: "POST", body: { label, address: address.trim(), category } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      await request("/api/destinations/confirm", { method: "POST", body: { confirmationId: pending.confirmationId } });
      setPending(null);
      setLabel("");
      setAddress("");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Save this destination? Check every character of the address. Transfers to it can&apos;t be reversed.</p>
        <dl className="space-y-1 rounded-[8px] bg-surface-2 p-3 text-sm">
          <div>Name: {pending.proposal.label}</div>
          <div>Category: {pending.proposal.category.toLowerCase()}</div>
          <div>
            Address: <Mono>{pending.proposal.address}</Mono>
          </div>
        </dl>
        <div className="flex gap-2">
          <Button onClick={confirm} disabled={busy}>Save destination</Button>
          <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={propose} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label>
          <Label>Name</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Savings wallet or Acme Hosting" required maxLength={64} />
        </label>
        <label>
          <Label>Wallet address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x…" required className="font-mono" />
        </label>
        <label>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" disabled={busy}>Review destination</Button>
    </form>
  );
}
