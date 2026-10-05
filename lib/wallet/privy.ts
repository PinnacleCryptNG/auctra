import { PrivyClient } from "@privy-io/node";
import { erc20Abi, type Address, type Hex } from "viem";
import { MONAD_TESTNET_CAIP2, MONAD_TESTNET_CHAIN_ID, assertMonadTestnet } from "../network";
import { MONAD_TESTNET_USDC_ADDRESS } from "../usdc";
import type { UnsignedContractCall, WalletSigner } from "./executor";

// Privy-backed WalletSigner. The authorization key is Auctra's app-level P-256
// signer key (a session signer on user wallets), never a user wallet key.

export type PrivyConfig = {
  appId: string;
  appSecret: string;
  authorizationPrivateKey: string;
};

export function privyConfigFromEnv(): PrivyConfig {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const authorizationPrivateKey = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY;

  if (!appId || !appSecret || !authorizationPrivateKey) {
    throw new Error(
      "NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET and PRIVY_AUTHORIZATION_PRIVATE_KEY must be configured."
    );
  }

  return { appId, appSecret, authorizationPrivateKey };
}

export function createPrivyClient(config: PrivyConfig) {
  return new PrivyClient({ appId: config.appId, appSecret: config.appSecret });
}

export function createPrivySigner(config: PrivyConfig, client = createPrivyClient(config)): WalletSigner {
  return {
    async sendTransaction(walletId: string, call: UnsignedContractCall, idempotencyKey: string) {
      assertMonadTestnet(call.chainId);

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

/**
 * Privy Policy Engine rules: the second, provider-side scope boundary. Allows only
 * eth_sendTransaction on Monad Testnet, to the USDC contract, calling
 * transfer(recipient, amount) with an allowlisted recipient and capped amount.
 * Anything else is denied by Privy even if Auctra's own validation has a bug.
 */
export function buildUsdcTransferPolicy({
  name,
  destinations,
  maxUnits
}: {
  name: string;
  destinations: Address[];
  maxUnits: bigint;
}) {
  if (destinations.length === 0) {
    throw new Error("A USDC transfer policy needs at least one allowlisted destination.");
  }

  const transferAbi = erc20Abi.filter((item) => item.type === "function" && item.name === "transfer");

  return {
    version: "1.0" as const,
    name,
    chain_type: "ethereum" as const,
    rules: [
      {
        name: "Allow capped USDC transfers to allowlisted destinations on Monad Testnet",
        method: "eth_sendTransaction" as const,
        action: "ALLOW" as const,
        conditions: [
          {
            field_source: "ethereum_transaction" as const,
            field: "chain_id" as const,
            operator: "eq" as const,
            value: String(MONAD_TESTNET_CHAIN_ID)
          },
          {
            field_source: "ethereum_transaction" as const,
            field: "to" as const,
            operator: "eq" as const,
            value: MONAD_TESTNET_USDC_ADDRESS
          },
          {
            field_source: "ethereum_calldata" as const,
            field: "transfer.recipient",
            abi: transferAbi,
            operator: "in" as const,
            value: destinations
          },
          {
            field_source: "ethereum_calldata" as const,
            field: "transfer.amount",
            abi: transferAbi,
            operator: "lte" as const,
            value: maxUnits.toString()
          }
        ]
      }
    ]
  };
}
