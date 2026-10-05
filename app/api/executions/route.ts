import { NextResponse } from "next/server";
import { requireReady, withAuth } from "@/lib/app/http";
import { explorerTxUrl } from "@/lib/chain/monad";
import { formatUsdc } from "@/lib/format";
import { listExecutions } from "@/lib/services/executions";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  // Quote everything; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const GET = withAuth(async (auth, request) => {
  const ctx = requireReady(auth);
  const format = new URL(request.url).searchParams.get("format");
  const rows = await listExecutions(auth.db, ctx.account.id, format === "csv" ? 5000 : 50);

  if (format === "csv") {
    const header = ["created_at", "status", "trigger", "amount_usdc", "destination", "category", "destination_address", "memo", "tx_hash", "explorer_url", "error_code", "execution_key"];
    const lines = rows.map(({ execution, automation, destination }) =>
      [
        execution.createdAt.toISOString(),
        execution.status,
        execution.trigger,
        formatUsdc(execution.amount),
        destination.label,
        destination.category,
        execution.destinationAddress,
        automation.memo,
        execution.txHash,
        execution.txHash ? explorerTxUrl(execution.txHash) : "",
        execution.errorCode,
        execution.executionKey
      ].map(csvCell).join(",")
    );
    return new Response([header.join(","), ...lines].join("\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="auctra-executions.csv"' }
    });
  }

  return NextResponse.json({
    executions: rows.map(({ execution, automation, destination }) => ({
      ...execution,
      memo: automation.memo,
      destination: { label: destination.label, category: destination.category },
      explorerUrl: execution.txHash ? explorerTxUrl(execution.txHash) : null
    }))
  });
});
