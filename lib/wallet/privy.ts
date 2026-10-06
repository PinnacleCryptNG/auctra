import { PrivyClient } from "@privy-io/node";
import type { Hex } from "viem";
import { ConfigurationError } from "../config";
import { MONAD_TESTNET_CAIP2, MONAD_TESTNET_CHAIN_ID, assertMonadTestnet } from "../network";
import type { UnsignedContractCall, WalletSigner } from "./executor";
import { assertUsdcTransferCall } from "./policy";

// Privy-backed WalletSigner.
//
// PRIVY_AUTHORIZATION_PRIVATE_KEY is Auctra's app-level P-256 *authorization*
// key. It signs Auctra's API requests to Privy (the privy-authorization-signature
// header); it is not a blockchain key and cannot sign a transaction by itself.
// Its public key is registered in Privy as a key quorum, whose ID is
// PRIVY_SIGNER_ID; the user adds that quorum to their wallet as a session signer.

/** Raised when required Privy settings are missing. Carries variable NAMES only, never values. */
export class PrivyNotConfiguredError extends ConfigurationError {
  constructor(missing: string[]) {
    super(missing);
    this.name = "PrivyNotConfiguredError";
  }
}

type Env = Record<string, string | undefined>;

function requireEnv(env: Env, names: string[]) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new PrivyNotConfiguredError(missing);
  return names.map((name) => env[name]!);
}

/** What sign-in and wallet lookups need: the Privy app ID and app secret. */
export type PrivyAppConfig = { appId: string; appSecret: string };

export function privyAppConfigFromEnv(env: Env = process.env): PrivyAppConfig {
  const [appId, appSecret] = requireEnv(env, ["NEXT_PUBLIC_PRIVY_APP_ID", "PRIVY_APP_SECRET"]);
  return { appId, appSecret };
}

/** Signing paths also need Auctra's app-level authorization key (PRD §7.1). */
export type PrivyConfig = PrivyAppConfig & { authorizationPrivateKey: string };

export function privyConfigFromEnv(env: Env = process.env): PrivyConfig {
  const [appId, appSecret, authorizationPrivateKey] = requireEnv(env, [
    "NEXT_PUBLIC_PRIVY_APP_ID",
    "PRIVY_APP_SECRET",
    "PRIVY_AUTHORIZATION_PRIVATE_KEY"
  ]);
  return { appId, appSecret, authorizationPrivateKey };
}

export function createPrivyClient(config: PrivyAppConfig) {
  return new PrivyClient({ appId: config.appId, appSecret: config.appSecret });
}

export function createPrivySigner(config: PrivyConfig, client = createPrivyClient(config)): WalletSigner {
  return {
    async sendTransaction(walletId: string, call: UnsignedContractCall, idempotencyKey: string) {
      assertMonadTestnet(call.chainId);
      // Same invariants as the Privy policy, checked before anything leaves Auctra:
      // chain 10143, the USDC contract, transfer(address,uint256) only, value 0.
      assertUsdcTransferCall({ ...call, value: BigInt(0) });

      const response = await client.wallets().ethereum().sendTransaction(walletId, {
        caip2: MONAD_TESTNET_CAIP2,
        params: {
          transaction: { chain_id: call.chainId, to: call.to, data: call.data, value: "0x0" }
        },
        idempotency_key: idempotencyKey,
        authorization_context: { authorization_private_keys: [config.authorizationPrivateKey] }
      });

      if (response.caip2 !== MONAD_TESTNET_CAIP2) {
        throw new Error(`Privy executed on unexpected chain ${response.caip2}.`);
      }

      return { hash: response.hash as Hex };
    }
  };
}
