import "server-only";
import { APIError, type PrivyClient } from "@privy-io/node";
import { eq } from "drizzle-orm";
import type { Address, Hex } from "viem";
import { getDb, type Db } from "../../db/client";
import { wallets } from "../../db/schema";
import { createClaudeIntentModel } from "../ai/intent-parser";
import { getMonadPublicClient } from "../chain/monad";
import { AuctraConfig } from "../config";
import { listDestinations } from "../services/destinations";
import { UserFacingError } from "../services/errors";
import type { ExecutionDeps } from "../services/executions";
import { createTelegramNotifier } from "../services/notifications";
import { createTelegramClient } from "../telegram/api";
import type { BotDeps } from "../telegram/bot";
import { parseUsdcAmount, readUsdcBalance } from "../usdc";
import { buildUsdcTransferPolicy, createPrivyClient, createPrivySigner, privyConfigFromEnv, type PrivyConfig } from "../wallet/privy";

// Production wiring. Everything is created lazily so builds don't need secrets.

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

let privy: { client: PrivyClient; config: PrivyConfig } | undefined;
export function getPrivy() {
  if (!privy) {
    const config = privyConfigFromEnv();
    privy = { client: createPrivyClient(config), config };
  }
  return privy;
}

export function getTelegram() {
  return createTelegramClient(required("TELEGRAM_BOT_TOKEN"));
}

/** A definite refusal from Privy (bad request / forbidden / policy denial): nothing was sent. */
export function isProviderRejection(error: unknown) {
  return error instanceof APIError && typeof error.status === "number" && [400, 401, 403, 422].includes(error.status);
}

export function getExecutionDeps(db: Db = getDb()): ExecutionDeps {
  const chain = getMonadPublicClient();
  const { config } = getPrivy();
  return {
    signer: createPrivySigner(config, getPrivy().client),
    readUsdcBalance: (owner: Address) => readUsdcBalance(chain, owner),
    waitForReceipt: async (hash: Hex) => {
      try {
        const receipt = await chain.waitForTransactionReceipt({ hash, timeout: 15_000 });
        return receipt.status === "success" ? "success" : "reverted";
      } catch {
        return null;
      }
    },
    isProviderRejection,
    notify: createTelegramNotifier(db, getTelegram())
  };
}

/**
 * Creates or updates the account's Privy policy so it allows USDC transfers
 * only to its saved destinations, capped per transfer (PRD §7.3 Layer 2).
 */
export async function syncTransferPolicy(db: Db, accountId: string): Promise<string> {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.accountId, accountId));
  if (!wallet) throw new UserFacingError("NO_WALLET", "Set up your wallet first.");

  const destinations = await listDestinations(db, accountId);
  if (destinations.length === 0) {
    throw new UserFacingError("NO_DESTINATIONS", "Save at least one destination before granting Auctra permission.");
  }

  const policy = buildUsdcTransferPolicy({
    name: `auctra-${accountId}`,
    destinations: destinations.map((d) => d.address as Address),
    maxUnits: parseUsdcAmount(AuctraConfig.maxTransferUsdc)
  });
  const { client, config } = getPrivy();
  const authorization_context = { authorization_private_keys: [config.authorizationPrivateKey] };

  if (wallet.privyPolicyId) {
    await client.policies().update(wallet.privyPolicyId, { rules: policy.rules, authorization_context });
    return wallet.privyPolicyId;
  }

  const created = await client.policies().create({ ...policy, owner_id: required("PRIVY_SIGNER_ID") });
  await db.update(wallets).set({ privyPolicyId: created.id }).where(eq(wallets.id, wallet.id));
  return created.id;
}

export function getBotDeps(db: Db = getDb()): BotDeps {
  return {
    db,
    telegram: getTelegram(),
    intentModel: createClaudeIntentModel(),
    appUrl: required("NEXT_PUBLIC_APP_URL").replace(/\/$/, ""),
    readBalances: async (address) => {
      const chain = getMonadPublicClient();
      const [mon, usdc] = await Promise.all([chain.getBalance({ address }), readUsdcBalance(chain, address)]);
      return { mon, usdc };
    },
    execution: getExecutionDeps(db),
    onDestinationsChanged: async (accountId) => {
      // Only an existing policy needs updating; a new one is created when the signer is granted.
      const [wallet] = await db.select().from(wallets).where(eq(wallets.accountId, accountId));
      if (wallet?.privyPolicyId) await syncTransferPolicy(db, accountId);
    }
  };
}
