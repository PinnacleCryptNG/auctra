import type { Me } from "./api";

/**
 * Where a person is in the Privy → Auctra wallet flow. The UI branches on this
 * and never assumes a later state: in particular a connected wallet is not
 * treated as authorized until Auctra's permission is actually granted.
 */
export type WalletReadiness =
  | "signed_out" // 1. not authenticated with Privy
  | "account_needed" // 2. authenticated, Auctra account not set up yet
  | "wallet_pending" // 2. authenticated, Auctra Wallet not connected yet
  | "permission_needed" // 3 + 4. wallet connected, Auctra not authorized to send
  | "ready"; // 5. ready for automation

export function walletReadiness(authenticated: boolean, me: Me | null): WalletReadiness {
  if (!authenticated) return "signed_out";
  if (!me?.linked || !me.account) return "account_needed";
  if (!me.wallet) return "wallet_pending";
  if (me.wallet.signerStatus !== "GRANTED") return "permission_needed";
  return "ready";
}
