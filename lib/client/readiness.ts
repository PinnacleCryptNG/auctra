import type { Me } from "./api";

/**
 * Where a person is in the Privy → Auctra wallet flow. The UI branches on this
 * and never assumes a later state: a connected wallet is not treated as
 * authorized until the server has verified Auctra's permission against Privy.
 *
 * Lifecycle: signed_out → account_needed → wallet_pending → permission_needed
 * → (user reviews the limits → approves in their wallet → server verifies) → ready.
 */
export type WalletReadiness =
  | "signed_out" // not authenticated with Privy
  | "account_needed" // authenticated, Auctra account not set up yet
  | "wallet_pending" // authenticated, Auctra Wallet not connected yet
  | "permission_needed" // wallet connected; permission missing, revoked or stale
  | "ready"; // permission verified for the account's current limits

export function walletReadiness(authenticated: boolean, me: Me | null): WalletReadiness {
  if (!authenticated) return "signed_out";
  if (!me?.linked || !me.account) return "account_needed";
  if (!me.wallet) return "wallet_pending";
  if (me.wallet.permission !== "VERIFIED") return "permission_needed";
  return "ready";
}

export type PermissionState = NonNullable<Me["wallet"]>["permission"];

/** User-facing copy for a permission state that isn't VERIFIED. */
export function permissionCopy(permission: PermissionState): { badge: string; title: string; description: string; action: string } {
  switch (permission) {
    case "STALE":
      return {
        badge: "Review needed",
        title: "Your permission needs a review",
        description: "Your saved destinations changed. Review Auctra's limits and approve them again before anything is sent.",
        action: "Review permission"
      };
    case "REVOKED":
      return {
        badge: "Permission revoked",
        title: "Automations can't send right now",
        description: "You revoked Auctra's permission. Approve it again to resume sending.",
        action: "Grant permission"
      };
    default:
      return {
        badge: "Permission needed",
        title: "Automations can't send right now",
        description: "Auctra needs your permission to send scheduled transfers from your wallet.",
        action: "Grant permission"
      };
  }
}
