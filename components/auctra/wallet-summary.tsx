"use client";

import { Address, Badge, ButtonLink, Card, ErrorState, Button, IconShield, IconWallet, Skeleton, TestnetBadge } from "@/components/ui";
import { friendlyError, type Balance, type Me } from "@/lib/client/api";
import { formatUsdc } from "@/lib/client/format";

/** Balance first, then the wallet's status in plain words (PRD §12–13). */
export function WalletSummary({
  me,
  balance,
  balanceLoading,
  balanceError,
  onRetry
}: {
  me: Me;
  balance: Balance | null;
  balanceLoading: boolean;
  balanceError: unknown;
  onRetry: () => void;
}) {
  const granted = me.wallet?.signerStatus === "GRANTED";
  return (
    <Card aria-labelledby="balance-heading" className="flex flex-col gap-4">
      <div className="grid gap-1 px-4 pt-4 sm:px-5 sm:pt-5">
        <h2 id="balance-heading" className="text-meta">
          Available balance
        </h2>
        {balanceLoading && !balance ? (
          <div role="status" aria-live="polite" className="grid gap-2 py-1">
            <span className="sr-only">Reading your balance…</span>
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : balanceError && !balance ? (
          <div className="py-2">
            <ErrorState
              title="Couldn't read your balance"
              description={friendlyError(balanceError).description}
              action={<Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}
            />
          </div>
        ) : (
          <>
            <p className="text-amount">
              {formatUsdc(balance?.usdc ?? "0")} <span className="text-[0.55em] font-medium text-ink-2">USDC</span>
            </p>
            <p className="text-secondary">
              Test funds on Monad Testnet{balance ? ` · ${Number(balance.mon).toFixed(2)} MON for network fees` : ""}
            </p>
          </>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line px-4 py-3 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-cloud text-lg text-ink-2">
          <IconWallet />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-h3">Auctra Wallet</span>
            <Badge tone="success" icon={<IconShield />}>Connected</Badge>
            {!granted && <Badge tone="warning">Permission needed</Badge>}
          </span>
          {me.wallet && <Address value={me.wallet.address} label="Wallet address" />}
        </div>
        {granted ? <TestnetBadge /> : <ButtonLink href="/onboarding" size="sm">Grant permission</ButtonLink>}
      </div>
    </Card>
  );
}
