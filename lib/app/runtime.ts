import "server-only";
import { APIError, type PrivyClient } from "@privy-io/node";
import type { Address, Hex } from "viem";
import { getDb, type Db } from "../../db/client";
import { createClaudeIntentModel } from "../ai/intent-parser";
import { getMonadPublicClient } from "../chain/monad";
import type { ExecutionDeps } from "../services/executions";
import { canonicalJson, sha256 } from "../services/hash";
import { createTelegramNotifier } from "../services/notifications";
import { createTelegramClient } from "../telegram/api";
import type { BotDeps } from "../telegram/bot";
import { siteUrl } from "../site";
import { readUsdcBalance } from "../usdc";
import { buildUserOwnedTransferPolicy, expectedPolicyFingerprint, verifyWalletPermission, type PermissionCheck, type TransferPolicyLimits } from "../wallet/policy";
import {
  createPrivyClient,
  createPrivySigner,
  privyAppConfigFromEnv,
  privyConfigFromEnv,
  PrivyNotConfiguredError,
  type PrivyConfig
} from "../wallet/privy";

// Production wiring. Everything is created lazily so builds don't need secrets.

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

let appClient: PrivyClient | undefined;
/** Privy client for sign-in verification and wallet lookups (app ID + secret only). */
export function getPrivyClient(): PrivyClient {
  if (!appClient) appClient = createPrivyClient(privyAppConfigFromEnv());
  return appClient;
}

let privy: { client: PrivyClient; config: PrivyConfig } | undefined;
/** Privy client plus Auctra's authorization key, for signer/policy paths only. */
export function getPrivy() {
  if (!privy) {
    const config = privyConfigFromEnv();
    privy = { client: getPrivyClient(), config };
  }
  return privy;
}

/**
 * The key quorum ID that contains Auctra's authorization public key. The user adds
 * it to their wallet as a session signer. It is NOT the owner of the policy.
 */
export function getSignerId() {
  const id = process.env.PRIVY_SIGNER_ID;
  if (!id) throw new PrivyNotConfiguredError(["PRIVY_SIGNER_ID"]);
  return id;
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
 * Creates a NEW Privy policy, owned by the user, that allows only capped USDC
 * transfers to the account's saved destinations on Monad Testnet. Auctra never
 * updates an existing policy: its server key must not be able to change the
 * user's limits. The user attaches the returned policy with `addSigners`, and
 * the grant is only recorded after verifyWalletPermission() succeeds.
 */
export async function createUserOwnedTransferPolicy(input: { privyUserId: string; privyWalletId: string; limits: TransferPolicyLimits }) {
  const fingerprint = expectedPolicyFingerprint(input.limits);
  const params = buildUserOwnedTransferPolicy({ name: `auctra-${fingerprint.slice(0, 16)}`, privyUserId: input.privyUserId, ...input.limits });
  const policy = await getPrivyClient()
    .policies()
    .create({
      ...params,
      // Same wallet + same request within Privy's 24h idempotency window -> same policy, not a new one per page view.
      // Keyed on the whole request, not just the limits, so a changed request (e.g. a renamed rule) isn't
      // answered with a cached response, including a cached error, for the old one.
      idempotency_key: `auctra-policy:${input.privyWalletId}:${sha256(canonicalJson(params))}`
    });
  return { policyId: policy.id, fingerprint };
}

/** Reads the wallet and policy from Privy and checks them against the account's current limits. */
export async function verifyPermissionWithPrivy(input: {
  privyWalletId: string;
  address: string;
  policyId: string;
  limits: TransferPolicyLimits;
}): Promise<PermissionCheck> {
  const client = getPrivyClient();
  const signerId = getSignerId();
  const wallet = await client.wallets().get(input.privyWalletId);
  // Only look up a policy the wallet actually binds to Auctra's signer: an ID the
  // browser sent that isn't on the wallet is refused without fetching anything.
  const attached = wallet.additional_signers.some((s) => s.signer_id === signerId && s.override_policy_ids?.includes(input.policyId));
  const policy = attached ? await client.policies().get(input.policyId) : null;
  return verifyWalletPermission({
    wallet,
    policy,
    expected: { privyWalletId: input.privyWalletId, address: input.address, signerId, policyId: input.policyId, limits: input.limits }
  });
}

export function getBotDeps(db: Db = getDb()): BotDeps {
  return {
    db,
    telegram: getTelegram(),
    intentModel: createClaudeIntentModel(),
    appUrl: siteUrl().origin,
    readBalances: async (address) => {
      const chain = getMonadPublicClient();
      const [mon, usdc] = await Promise.all([chain.getBalance({ address }), readUsdcBalance(chain, address)]);
      return { mon, usdc };
    },
    execution: getExecutionDeps(db),
    // Changing destinations never touches the Privy policy: the stored permission
    // becomes STALE (lib/services/permission.ts) until the user approves again.
    onDestinationsChanged: async () => {}
  };
}
