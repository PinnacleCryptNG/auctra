import { createPublicClient, http, type PublicClient } from "viem";
import { monadTestnet } from "viem/chains";
import { assertMonadTestnet, assertTestnetEnvironment } from "../network";

assertMonadTestnet(monadTestnet.id);

export { monadTestnet };

export function getMonadPublicClient(): PublicClient {
  assertTestnetEnvironment();

  const rpcUrl = process.env.MONAD_RPC_URL;
  if (!rpcUrl) {
    throw new Error("MONAD_RPC_URL is not configured.");
  }

  return createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) });
}

export function explorerTxUrl(txHash: string) {
  return `${monadTestnet.blockExplorers.default.url}/tx/${txHash}`;
}
