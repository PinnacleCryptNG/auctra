import { getAddress, isAddress } from "viem";
import { MONAD_TESTNET_CHAIN_ID } from "../network";
import { UserFacingError } from "../services/errors";

// The only wallet facts Auctra stores (PRD §7.1, §18): which Privy wallet,
// its public address, and the chain it is used on. Never keys, seeds or tokens.

export type WalletMetadata = {
  privyWalletId: string;
  address: `0x${string}`;
  chainId: typeof MONAD_TESTNET_CHAIN_ID;
};

/** The fields Auctra reads from a Privy wallet (subset of @privy-io/node's Wallet). */
export type PrivyWalletSummary = {
  id: string;
  address: string;
  chain_type: string;
  archived_at?: number | null;
  imported_at?: number | null;
};

const PRIVY_WALLET_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Validates wallet metadata before it is stored. Monad Testnet (10143) only. */
export function validateWalletMetadata(input: { privyWalletId: string; address: string; chainId: number }): WalletMetadata {
  if (!PRIVY_WALLET_ID.test(input.privyWalletId ?? "")) {
    throw new UserFacingError("INVALID_WALLET", "This wallet couldn't be verified. Please try again.");
  }
  if (!isAddress(input.address ?? "", { strict: false })) {
    throw new UserFacingError("INVALID_WALLET", "This wallet's address isn't valid.");
  }
  if (input.chainId !== MONAD_TESTNET_CHAIN_ID) {
    throw new UserFacingError("WRONG_CHAIN", "Auctra only works on Monad Testnet.");
  }
  return { privyWalletId: input.privyWalletId, address: getAddress(input.address), chainId: MONAD_TESTNET_CHAIN_ID };
}

/**
 * Picks the user's Privy embedded EVM wallet to use as the Auctra Wallet.
 * Wallets created by importing a private key are never used: Auctra's
 * security model is that keys are only ever generated and held by Privy.
 */
export function selectEmbeddedWallet(wallets: PrivyWalletSummary[]): PrivyWalletSummary | null {
  return wallets.find((w) => w.chain_type === "ethereum" && !w.archived_at && !w.imported_at) ?? null;
}
