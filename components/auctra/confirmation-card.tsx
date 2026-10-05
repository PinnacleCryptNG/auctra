import { Address, TestnetBadge } from "@/components/ui";
import type { AutomationPreview } from "@/lib/client/api";
import { actionLabel, formatDay, formatTime, formatUsdc, scheduleParts } from "@/lib/client/format";

/**
 * Auctra's reading of a request, as plain fields: what, when, to whom, under
 * which condition, on which network. Shown before anything is activated.
 */
export function ConfirmationCard({ preview, accountLabel = "Auctra Wallet" }: { preview: AutomationPreview; accountLabel?: string }) {
  const { cadence, time } = scheduleParts(preview.schedule);
  const verb = actionLabel(preview.destination.category);

  return (
    <article aria-label="Automation details" className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <header className="border-b border-line bg-cloud/60 px-4 py-4 sm:px-5">
        <p className="text-meta">Auctra will</p>
        <p className="mt-1 text-h1">
          {verb} <span className="tabular-nums">{formatUsdc(preview.amount)}</span> USDC
        </p>
      </header>
      <dl className="grid divide-y divide-line px-4 sm:px-5">
        <Row label="When">
          <span className="font-medium">{cadence}</span>
          <span className="text-ink-2"> · {time}</span>
          <span className="block text-sm text-slate">
            First run {formatDay(preview.firstRunAt, preview.timezone)}, {formatTime(preview.firstRunAt, preview.timezone)} ({preview.timezone})
          </span>
        </Row>
        <Row label="To">
          <span className="block font-medium">{preview.destination.label}</span>
          <Address value={preview.destination.address} label="Destination address" />
        </Row>
        <Row label="Condition">
          {preview.condition ? (
            <span>Only if your balance is at least {formatUsdc(preview.condition.amount)} USDC</span>
          ) : (
            <span className="text-ink-2">None</span>
          )}
        </Row>
        {preview.balanceFloor && Number(preview.balanceFloor) > 0 && (
          <Row label="Floor">Keeps at least {formatUsdc(preview.balanceFloor)} USDC in your wallet</Row>
        )}
        {preview.memo && <Row label="Memo">{preview.memo}</Row>}
        <Row label="Network">
          <span className="inline-flex flex-wrap items-center gap-2">
            Monad Testnet <TestnetBadge compact />
          </span>
        </Row>
        <Row label="From">
          <span className="block">{accountLabel}</span>
          <Address value={preview.wallet.address} label="Your wallet address" />
        </Row>
      </dl>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 py-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <dt className="pt-px text-sm text-slate">{label}</dt>
      <dd className="m-0 min-w-0 text-[0.9375rem] leading-6">{children}</dd>
    </div>
  );
}
