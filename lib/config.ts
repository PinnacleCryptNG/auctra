import { MONAD_TESTNET_CHAIN_ID } from "./network";

export const AuctraConfig = {
  chainId: MONAD_TESTNET_CHAIN_ID,
  network: "testnet",
  asset: "USDC",
  // PRD §7.3 MVP defaults, in whole USDC.
  maxTransferUsdc: "100",
  dailyCapUsdc: "250"
} as const;
