import { Address, StatusBadge } from "@/components/ui";
import type { Execution } from "@/lib/client/api";
import { executionReason, executionStatus, formatDate, formatDateTime, formatTime, formatUsdc } from "@/lib/client/format";

/**
 * Execution history. A real table from 768px up; a stacked list on phones so
 * nothing is squeezed into tiny columns.
 */
export function ExecutionList({ executions, timezone }: { executions: Execution[]; timezone?: string }) {
  return (
    <>
      <ul className="grid divide-y divide-line md:hidden">
        {executions.map((e) => (
          <li key={e.id} className="grid gap-1.5 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[1.0625rem] font-semibold tabular-nums">{formatUsdc(e.amount)} USDC</span>
              <StatusBadge status={executionStatus(e.status)} />
            </div>
            <p className="text-sm text-ink-2">
              to <span className="font-medium text-ink">{e.destination.label}</span>
              {e.memo && <span className="text-slate"> · {e.memo}</span>}
            </p>
            <p className="text-xs text-slate">
              <time dateTime={e.createdAt}>{formatDateTime(e.createdAt, timezone)}</time>
              {e.trigger === "MANUAL" && " · Run now"}
            </p>
            {e.txHash ? (
              <Address value={e.txHash} label="Transaction hash" href={e.explorerUrl} hrefLabel="View transaction" />
            ) : (
              <p className="text-sm text-ink-2">{executionReason(e)}</p>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">Execution history</caption>
          <colgroup>
            <col className="w-[8.5rem]" />
            <col className="w-[8rem]" />
            <col />
            <col className="w-[11rem]" />
            <col className="w-[13.5rem]" />
          </colgroup>
          <thead>
            <tr className="border-b border-line">
              {["Status", "Amount", "Automation", "Date", "Transaction"].map((h) => (
                <th key={h} scope="col" className="text-meta px-5 py-2.5 font-medium first:pl-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {executions.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="px-5 py-3">
                  <StatusBadge status={executionStatus(e.status)} />
                </td>
                <td className="px-5 py-3 font-semibold tabular-nums">{formatUsdc(e.amount)} USDC</td>
                <td className="min-w-0 px-5 py-3">
                  <span className="block truncate font-medium">{e.destination.label}</span>
                  <span className="block text-slate">
                    {e.trigger === "MANUAL" ? "Run now" : "Scheduled"}
                    {e.memo ? ` · ${e.memo}` : ""}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <time dateTime={e.createdAt} className="grid">
                    <span>{formatDate(e.createdAt, timezone)}</span>
                    <span className="text-slate">{formatTime(e.createdAt, timezone)}</span>
                  </time>
                </td>
                <td className="min-w-0 px-5 py-3">
                  {e.txHash ? (
                    <Address value={e.txHash} label="Transaction hash" href={e.explorerUrl} hrefLabel="View transaction" />
                  ) : (
                    <span className="text-ink-2">{executionReason(e)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
