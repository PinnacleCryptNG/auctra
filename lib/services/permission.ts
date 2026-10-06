import type { Db } from "../../db/client";
import { AuctraConfig } from "../config";
import { parseUsdcAmount } from "../usdc";
import { expectedPolicyFingerprint, type TransferPolicyLimits } from "../wallet/policy";
import type { Wallet } from "./accounts";
import { listDestinations } from "./destinations";

/**
 * Auctra's view of its session-signer permission on a wallet.
 *
 * - NOT_GRANTED: the user hasn't approved Auctra yet.
 * - REVOKED: the user removed Auctra's permission.
 * - STALE: a permission was verified once, but for different limits than the
 *   account has now (e.g. a destination was added or removed), or it predates
 *   policy fingerprints. The user must review and approve again.
 * - VERIFIED: Privy's records were checked server-side and match the limits
 *   the account has now. The only state in which Auctra may execute.
 */
export type PermissionState = "NOT_GRANTED" | "REVOKED" | "STALE" | "VERIFIED";

/** The limits Auctra's policy must enforce for this account right now, or null if there is nothing to allow. */
export async function currentPolicyLimits(db: Db, accountId: string): Promise<TransferPolicyLimits | null> {
  const destinations = await listDestinations(db, accountId);
  if (destinations.length === 0) return null;
  return { recipients: destinations.map((d) => d.address), maxUnits: parseUsdcAmount(AuctraConfig.maxTransferUsdc) };
}

export function permissionState(wallet: Pick<Wallet, "signerStatus" | "privyPolicyId" | "policyFingerprint">, limits: TransferPolicyLimits | null): PermissionState {
  if (wallet.signerStatus === "NOT_GRANTED") return "NOT_GRANTED";
  if (wallet.signerStatus === "REVOKED") return "REVOKED";
  if (!wallet.privyPolicyId || !wallet.policyFingerprint || !limits) return "STALE";
  return wallet.policyFingerprint === expectedPolicyFingerprint(limits) ? "VERIFIED" : "STALE";
}

export async function loadPermissionState(db: Db, wallet: Wallet): Promise<PermissionState> {
  return permissionState(wallet, await currentPolicyLimits(db, wallet.accountId));
}
