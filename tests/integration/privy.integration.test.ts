// REAL Privy integration tests. Nothing here is mocked: these call Privy's
// API with the app's credentials. They run only via `npm run test:integration`
// and only when the variables below are set; otherwise they are skipped and
// say why. A skipped run proves nothing about Privy.
//
// Required:  NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET
// Optional:  PRIVY_TEST_ACCESS_TOKEN  (a fresh access token from a real sign-in, for token verification)
//            PRIVY_TEST_USER_ID       (a Privy user ID with an embedded wallet, for wallet lookup)

import { describe, expect, it } from "vitest";
import { MONAD_TESTNET_CHAIN_ID } from "../../lib/network";
import { selectEmbeddedWallet, validateWalletMetadata, type PrivyWalletSummary } from "../../lib/wallet/metadata";
import { createPrivyClient, privyAppConfigFromEnv } from "../../lib/wallet/privy";

const env = process.env;
const hasApp = Boolean(env.NEXT_PUBLIC_PRIVY_APP_ID && env.PRIVY_APP_SECRET);
if (!hasApp) console.warn("[privy integration] SKIPPED: set NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET to run against real Privy.");

describe.skipIf(!hasApp)("Privy (real API)", () => {
  const client = () => createPrivyClient(privyAppConfigFromEnv());

  it("rejects a forged access token", async () => {
    await expect(client().utils().auth().verifyAccessToken("forged.token.value")).rejects.toBeTruthy();
  });

  it.skipIf(!env.PRIVY_TEST_ACCESS_TOKEN)("verifies a real access token", async () => {
    const claims = await client().utils().auth().verifyAccessToken(env.PRIVY_TEST_ACCESS_TOKEN!);
    expect(claims.app_id).toBe(env.NEXT_PUBLIC_PRIVY_APP_ID);
    expect(claims.user_id).toMatch(/^did:privy:/);
  });

  it.skipIf(!env.PRIVY_TEST_USER_ID)("finds the user's embedded wallet and it passes Auctra's metadata rules", async () => {
    const found: PrivyWalletSummary[] = [];
    for await (const wallet of client().wallets().list({ user_id: env.PRIVY_TEST_USER_ID!, chain_type: "ethereum" })) found.push(wallet);
    const wallet = selectEmbeddedWallet(found);
    expect(wallet, "no embedded EVM wallet for PRIVY_TEST_USER_ID").not.toBeNull();
    const metadata = validateWalletMetadata({ privyWalletId: wallet!.id, address: wallet!.address, chainId: MONAD_TESTNET_CHAIN_ID });
    expect(metadata.chainId).toBe(10143);
  });
});
