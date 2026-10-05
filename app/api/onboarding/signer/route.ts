import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, requireReady, withAuth } from "@/lib/app/http";
import { getPrivy, syncTransferPolicy } from "@/lib/app/runtime";
import { setSignerStatus } from "@/lib/services/accounts";
import { UserFacingError } from "@/lib/services/errors";

function signerId() {
  const id = process.env.PRIVY_SIGNER_ID;
  if (!id) throw new Error("PRIVY_SIGNER_ID is not configured.");
  return id;
}

/** Returns what the browser needs to add Auctra's session signer with its policy (PRD §7.2). */
export const GET = withAuth(async (auth) => {
  const ctx = requireReady(auth);
  const policyId = await syncTransferPolicy(auth.db, ctx.account.id);
  return NextResponse.json({ address: ctx.wallet.address, signerId: signerId(), policyId, status: ctx.wallet.signerStatus });
});

/** Records a grant or revoke, after checking the wallet's actual signers on Privy. */
export const POST = withAuth(async (auth, request) => {
  const ctx = requireReady(auth);
  const { action } = await readJson(request, z.object({ action: z.enum(["granted", "revoked"]) }));

  if (action === "revoked") {
    await setSignerStatus(auth.db, { accountId: ctx.account.id, userId: ctx.user.id, status: "REVOKED" });
    return NextResponse.json({ status: "REVOKED" });
  }

  const wallet = await getPrivy().client.wallets().get(ctx.wallet.privyWalletId);
  const signer = wallet.additional_signers.find((s) => s.signer_id === signerId());
  if (!signer) throw new UserFacingError("SIGNER_MISSING", "Auctra's permission wasn't found on your wallet. Please try again.");
  if (!ctx.wallet.privyPolicyId || !signer.override_policy_ids?.includes(ctx.wallet.privyPolicyId)) {
    throw new UserFacingError("POLICY_MISSING", "The permission was added without Auctra's safety policy. Remove it and try again.");
  }

  await setSignerStatus(auth.db, { accountId: ctx.account.id, userId: ctx.user.id, status: "GRANTED", privyPolicyId: ctx.wallet.privyPolicyId });
  return NextResponse.json({ status: "GRANTED" });
});
