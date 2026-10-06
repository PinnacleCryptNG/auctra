export const MONAD_TESTNET_CHAIN_ID = 10143 as const;
export const MONAD_TESTNET_CAIP2 = `eip155:${MONAD_TESTNET_CHAIN_ID}` as const;

export function assertMonadTestnet(chainId: number): asserts chainId is typeof MONAD_TESTNET_CHAIN_ID {
  if (chainId !== MONAD_TESTNET_CHAIN_ID) {
    throw new Error("Auctra MVP supports Monad Testnet only.");
  }
}

export function assertTestnetEnvironment() {
  if (process.env.AUCTRA_NETWORK !== "testnet") {
    throw new Error("Auctra execution is locked to testnet.");
  }

  const chainId = Number(process.env.MONAD_CHAIN_ID);
  assertMonadTestnet(chainId);
}
