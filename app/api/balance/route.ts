import { NextResponse } from "next/server";
import type { Address } from "viem";
import { requireReady, withAuth } from "@/lib/app/http";
import { getMonadPublicClient } from "@/lib/chain/monad";
import { formatUsdcAmount, readUsdcBalance } from "@/lib/usdc";

export const GET = withAuth(async (auth) => {
  const { wallet } = requireReady(auth);
  const chain = getMonadPublicClient();
  const address = wallet.address as Address;
  const [mon, usdc] = await Promise.all([chain.getBalance({ address }), readUsdcBalance(chain, address)]);
  return NextResponse.json({ network: "Monad Testnet", address, usdc: formatUsdcAmount(usdc), mon: (Number(mon) / 1e18).toFixed(4) });
});
