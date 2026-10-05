import { eq } from "drizzle-orm";
import type { Db } from "../../db/client";
import { accounts, users } from "../../db/schema";
import { explorerTxUrl } from "../chain/monad";
import { formatUsdc } from "../format";
import type { TelegramClient } from "../telegram/api";
import type { ExecutionNotice } from "./executions";

/** PRD §13: every action ends in success, skipped or failed, reported in Telegram. */
export function executionMessage({ execution, automation, destination }: ExecutionNotice): string {
  const what = `${formatUsdc(execution.amount)} USDC to ${destination.label}${automation.memo ? ` (memo: ${automation.memo})` : ""}`;
  const kind = execution.trigger === "MANUAL" ? "Run now" : "Scheduled run";

  switch (execution.status) {
    case "CONFIRMED":
      return [`Sent ${what}.`, `Transaction: ${execution.txHash}`, explorerTxUrl(execution.txHash!), `${kind} · Monad Testnet`].join("\n");
    case "SKIPPED":
      return `Skipped ${what}: ${execution.errorMessage ?? execution.errorCode}\n${kind} · nothing was sent.`;
    case "REJECTED":
      return `Blocked ${what}: ${execution.errorMessage ?? execution.errorCode}\n${kind} · nothing was sent.`;
    case "FAILED":
      return [`Failed ${what}: ${execution.errorMessage ?? execution.errorCode}`, execution.txHash ? explorerTxUrl(execution.txHash) : ""]
        .filter(Boolean)
        .join("\n");
    case "UNKNOWN":
      return `Unconfirmed ${what}: ${execution.errorMessage ?? execution.errorCode}\nAuctra will not retry this automatically. Check your wallet history before running it again.`;
    default:
      return `${what}: ${execution.status.toLowerCase()}`;
  }
}

export function createTelegramNotifier(db: Db, telegram: TelegramClient) {
  return async (notice: ExecutionNotice) => {
    const [owner] = await db
      .select({ chatId: users.telegramChatId })
      .from(accounts)
      .innerJoin(users, eq(users.id, accounts.ownerUserId))
      .where(eq(accounts.id, notice.accountId));
    if (owner?.chatId) await telegram.sendMessage(owner.chatId, executionMessage(notice));
  };
}
