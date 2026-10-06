import { NextResponse } from "next/server";
import { withAuth } from "@/lib/app/http";
import { AuctraConfig } from "@/lib/config";
import { loadPermissionState } from "@/lib/services/permission";

export const GET = withAuth(async (auth) => {
  const ctx = auth.ctx;
  return NextResponse.json({
    linked: Boolean(ctx),
    user: ctx ? { timezone: ctx.user.timezone } : null,
    account: ctx?.account ? { id: ctx.account.id, type: ctx.account.type, businessName: ctx.account.businessName } : null,
    wallet: ctx?.wallet
      ? {
          address: ctx.wallet.address,
          chainId: ctx.wallet.chainId,
          signerStatus: ctx.wallet.signerStatus,
          permission: await loadPermissionState(auth.db, ctx.wallet),
          balanceFloor: ctx.wallet.balanceFloor
        }
      : null,
    limits: { maxTransferUsdc: AuctraConfig.maxTransferUsdc, dailyCapUsdc: AuctraConfig.dailyCapUsdc }
  });
});
