import { MONAD_TESTNET_CHAIN_ID } from "./network";

/** Required server configuration is missing. Carries variable NAMES only, never values. */
export class ConfigurationError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing or invalid environment variables: ${missing.join(", ")}`);
    this.name = "ConfigurationError";
  }
}

export const AuctraConfig = {
  chainId: MONAD_TESTNET_CHAIN_ID,
  network: "testnet",
  asset: "USDC",
  // PRD §7.3 MVP defaults, in whole USDC.
  maxTransferUsdc: "100",
  dailyCapUsdc: "250"
} as const;
