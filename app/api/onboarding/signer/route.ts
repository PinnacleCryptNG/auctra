import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireReady, withAuth } from "@/lib/app/http";
import { createUserOwnedTransferPolicy, getSignerId, verifyPermissionWithPrivy } from "@/lib/app/runtime";
import { AuctraConfig } from "@/lib/config";
import { MONAD_TESTNET_CHAIN_ID } from "@/lib/network";
import { setSignerStatus } from "@/lib/services/accounts";
import { listDestinations } from "@/lib/services/destinations";
import { UserFacingError } from "@/lib/services/errors";
import { currentPolicyLimits, loadPermissionState } from "@/lib/services/permission";
import { MONAD_TESTNET_USDC_ADDRESS } from "@/lib/usdc";
import type { PermissionFailure } from "@/lib/wallet/policy";

// Authorization lifecycle (PRD §7.2, docs/FEASIBILITY-privy-monad.md §12):
//   GET  → Auctra creates a user-owned policy for the account's current limits and
//          returns exactly what the user is approving (review).
//   browser → the user approves in their wallet: addSigners({ signerId, policyIds: [policyId] }).
//   POST granted → Auctra reads the wallet and policy back from Privy and records
//          the permission only if they match. Nothing the browser says is trusted.

export const GET = withAuth(async (auth) => {
  const ctx = requireReady(auth);
  if (!ctx.user.privyUserId) throw new UserFacingError("NOT_LINKED", "Sign in with your Auctra login to continue.");
  const limits = await currentPolicyLimits(auth.db, ctx.account.id);
  if (!limits) throw new UserFacingError("NO_DESTINATIONS", "Save at least one destination before granting Auctra permission.");

  const { policyId } = await createUserOwnedTransferPolicy({ privyUserId: ctx.user.privyUserId, privyWalletId: ctx.wallet.privyWalletId, limits });
  const destinations = await listDestinations(auth.db, ctx.account.id);

  return NextResponse.json({
    address: ctx.wallet.address,
    signerId: getSignerId(),
    policyId,
    permission: await loadPermissionState(auth.db, ctx.wallet),
    review: {
      network: "Monad Testnet",
      chainId: MONAD_TESTNET_CHAIN_ID,
      asset: "USDC",
      contract: MONAD_TESTNET_USDC_ADDRESS,
      maxTransferUsdc: AuctraConfig.maxTransferUsdc,
      dailyCapUsdc: AuctraConfig.dailyCapUsdc,
      recipients: destinations.map((d) => ({ label: d.label, address: d.address }))
    }
  });
});

const FAILURE_MESSAGES: Record<PermissionFailure, string> = {
  WALLET_MISMATCH: "This permission is for a different wallet. Please try again.",
  WALLET_IMPORTED: "Auctra can't use this wallet.",
  SIGNER_MISSING: "Auctra's permission wasn't found on your wallet. Please try again.",
  POLICY_NOT_ATTACHED: "The permission was added without Auctra's limits. Remove it and try again.",
  POLICY_NOT_USER_OWNED: "The permission's limits aren't controlled by you. Remove it and try again.",
  POLICY_MISMATCH: "The permission's limits don't match your saved destinations. Review and approve again."
};

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("granted"), policyId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }),
  z.object({ action: z.literal("revoked") })
]);

export const POST = withAuth(async (auth, request) => {
  const ctx = requireReady(auth);
  const input = await readJson(request, body);

  if (input.action === "revoked") {
    // Recording a revocation is always safe: it only ever stops execution.
    await setSignerStatus(auth.db, { accountId: ctx.account.id, userId: ctx.user.id, status: "REVOKED" });
    return NextResponse.json({ permission: "REVOKED" });
  }

  const limits = await currentPolicyLimits(auth.db, ctx.account.id);
  if (!limits) throw new UserFacingError("NO_DESTINATIONS", "Save at least one destination before granting Auctra permission.");

  const check = await verifyPermissionWithPrivy({ privyWalletId: ctx.wallet.privyWalletId, address: ctx.wallet.address, policyId: input.policyId, limits });
  if (!check.ok) throw new UserFacingError(`PERMISSION_${check.reason}`, FAILURE_MESSAGES[check.reason]);

  await setSignerStatus(auth.db, {
    accountId: ctx.account.id,
    userId: ctx.user.id,
    status: "GRANTED",
    privyPolicyId: input.policyId,
    policyFingerprint: check.fingerprint
  });
  return NextResponse.json({ permission: "VERIFIED" });
});
