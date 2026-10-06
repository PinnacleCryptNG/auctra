// FIRST LIVE SPIKE: one real USDC transfer on Monad Testnet through Privy's
// session signer, plus the refusals the user-owned policy must produce.
//
// Nothing here is mocked or simulated. Every step either runs against the real
// Monad Testnet RPC and the real Privy API, or is SKIPPED with the reason.
// A skipped run proves nothing. Run with:
//
//   npm run test:integration
//
// Moving testnet funds needs an explicit opt-in (AUCTRA_LIVE_SPIKE=1).
// The step letters match docs/FEASIBILITY-privy-monad.md §13.
//
// Manual steps (they need the wallet owner, so a test can't do them):
//   B. Sign in to the app with the spike user, save SPIKE_RECIPIENT as the only
//      destination, and approve Auctra's permission (onboarding → Approve).
//      Copy the policy ID shown by GET /api/onboarding/signer into SPIKE_POLICY_ID.
//   M. Revoke the permission in Settings, then rerun with SPIKE_PHASE=revoked.

import { APIError } from "@privy-io/node";
import { mkdirSync, writeFileSync } from "node:fs";
import { encodeFunctionData, erc20Abi, getAddress, isAddress, parseEventLogs, type Address, type Hex, type PublicClient } from "viem";
import { beforeAll, describe, expect, it } from "vitest";
import { explorerTxUrl, getMonadPublicClient } from "../../lib/chain/monad";
import { AuctraConfig } from "../../lib/config";
import { MONAD_TESTNET_CAIP2, MONAD_TESTNET_CHAIN_ID } from "../../lib/network";
import { MONAD_TESTNET_USDC_ADDRESS, encodeUsdcTransfer, parseUsdcAmount, readUsdcBalance, verifyUsdcContract } from "../../lib/usdc";
import { verifyWalletPermission } from "../../lib/wallet/policy";
import { createPrivyClient, createPrivySigner, privyConfigFromEnv } from "../../lib/wallet/privy";

const env = process.env;
const TIMEOUT = 180_000;

const optedIn = env.AUCTRA_LIVE_SPIKE === "1";
const hasRpc = Boolean(env.MONAD_RPC_URL && env.AUCTRA_NETWORK === "testnet" && env.MONAD_CHAIN_ID === "10143");
const PRIVY_VARS = ["NEXT_PUBLIC_PRIVY_APP_ID", "PRIVY_APP_SECRET", "PRIVY_AUTHORIZATION_PRIVATE_KEY", "PRIVY_SIGNER_ID"];
const SPIKE_VARS = ["SPIKE_PRIVY_WALLET_ID", "SPIKE_WALLET_ADDRESS", "SPIKE_POLICY_ID", "SPIKE_RECIPIENT"];
const missing = [...PRIVY_VARS, ...SPIKE_VARS].filter((name) => !env[name]);
const hasPrivy = missing.length === 0;
const phase = env.SPIKE_PHASE === "revoked" ? "revoked" : "granted";

// Reported by NAME only; values are never printed.
if (!optedIn) console.warn("[live spike] SKIPPED: set AUCTRA_LIVE_SPIKE=1 to run against Monad Testnet and Privy.");
else if (!hasRpc) console.warn("[live spike] SKIPPED: set MONAD_RPC_URL, AUCTRA_NETWORK=testnet and MONAD_CHAIN_ID=10143.");
else if (!hasPrivy) console.warn(`[live spike] Privy steps SKIPPED: missing ${missing.join(", ")}.`);

const address = (name: string) => {
  const value = env[name];
  if (!value || !isAddress(value)) throw new Error(`${name} must be an address`);
  return getAddress(value);
};

/** A refusal from Privy: an API error, and the wallet's nonce did not move. */
async function expectRefused(chain: PublicClient, wallet: Address, attempt: () => Promise<unknown>) {
  const nonceBefore = await chain.getTransactionCount({ address: wallet, blockTag: "pending" });
  let result: unknown;
  let error: unknown;
  try {
    result = await attempt();
  } catch (e) {
    error = e;
  }
  expect(result, "Privy accepted a request the policy must refuse").toBeUndefined();
  expect(error).toBeInstanceOf(APIError);
  expect((error as APIError).status).toBeGreaterThanOrEqual(400);
  expect((error as APIError).status).toBeLessThan(500);
  expect(await chain.getTransactionCount({ address: wallet, blockTag: "pending" })).toBe(nonceBefore);
}

const results: Record<string, unknown> = { startedAt: new Date().toISOString(), phase };
function record(key: string, value: unknown) {
  results[key] = value;
  mkdirSync(".spike", { recursive: true });
  writeFileSync(".spike/last-run.json", JSON.stringify(results, null, 2));
}

describe.skipIf(!optedIn || !hasRpc)("Monad Testnet USDC contract (live, read-only)", () => {
  it("is 6-decimal USDC on chain 10143, with transfer(address,uint256)", { timeout: TIMEOUT }, async () => {
    const chain = getMonadPublicClient();
    expect(await chain.getChainId()).toBe(MONAD_TESTNET_CHAIN_ID);
    expect(await verifyUsdcContract(chain)).toEqual({ symbol: "USDC", decimals: 6 });
    expect((await chain.getCode({ address: MONAD_TESTNET_USDC_ADDRESS }))?.length ?? 0).toBeGreaterThan(2);

    if (env.SPIKE_WALLET_ADDRESS && env.SPIKE_RECIPIENT) {
      // Simulated from the funded wallet: proves transfer(address,uint256) exists and returns true.
      const { result } = await chain.simulateContract({
        address: MONAD_TESTNET_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [address("SPIKE_RECIPIENT"), BigInt(1)],
        account: address("SPIKE_WALLET_ADDRESS")
      });
      expect(result).toBe(true);
    }
    record("usdcContract", { address: MONAD_TESTNET_USDC_ADDRESS, symbol: "USDC", decimals: 6, verifiedAt: new Date().toISOString() });
  });
});

describe.skipIf(!optedIn || !hasRpc || !hasPrivy)(`Privy session signer on Monad Testnet (live, phase=${phase})`, () => {
  let chain: PublicClient;
  let wallet: Address;
  let recipient: Address;
  const amount = parseUsdcAmount(env.SPIKE_AMOUNT_USDC ?? "0.01");
  const cap = parseUsdcAmount(env.SPIKE_MAX_USDC ?? AuctraConfig.maxTransferUsdc);
  const allowlist = () => (env.SPIKE_ALLOWLIST ?? env.SPIKE_RECIPIENT!).split(",").map((a) => a.trim());
  const config = () => privyConfigFromEnv();
  const client = () => createPrivyClient(config());
  const walletId = () => env.SPIKE_PRIVY_WALLET_ID!;

  /** Bypasses Auctra's own guard on purpose: these requests test Privy's policy, not Auctra. */
  const rawSend = (transaction: { to: Address; data?: Hex; value?: string }, idempotencyKey: string) =>
    client()
      .wallets()
      .ethereum()
      .sendTransaction(walletId(), {
        caip2: MONAD_TESTNET_CAIP2,
        params: { transaction: { chain_id: MONAD_TESTNET_CHAIN_ID, value: "0x0", ...transaction } },
        idempotency_key: idempotencyKey,
        authorization_context: { authorization_private_keys: [config().authorizationPrivateKey] }
      });
  const runKey = (step: string) => `spike:${results.startedAt}:${step}`;

  beforeAll(async () => {
    chain = getMonadPublicClient();
    wallet = address("SPIKE_WALLET_ADDRESS");
    recipient = address("SPIKE_RECIPIENT");
    await verifyUsdcContract(chain); // fail closed before any request that could move funds
  }, TIMEOUT);

  it.runIf(phase === "granted")("A. the spike wallet is funded with MON (gas) and USDC", { timeout: TIMEOUT }, async () => {
    expect(await chain.getBalance({ address: wallet })).toBeGreaterThan(BigInt(0));
    expect(await readUsdcBalance(chain, wallet)).toBeGreaterThanOrEqual(amount * BigInt(2));
  });

  it.runIf(phase === "granted")("C. Privy's records show Auctra's signer bound to the user-owned policy", { timeout: TIMEOUT }, async () => {
    const [privyWallet, policy] = await Promise.all([client().wallets().get(walletId()), client().policies().get(env.SPIKE_POLICY_ID!)]);
    const check = verifyWalletPermission({
      wallet: privyWallet,
      policy,
      expected: { privyWalletId: walletId(), address: wallet, signerId: env.PRIVY_SIGNER_ID!, policyId: env.SPIKE_POLICY_ID!, limits: { recipients: allowlist(), maxUnits: cap } }
    });
    record("permission", { ...check, policyOwnerId: policy.owner_id });
    expect(check).toMatchObject({ ok: true });
  });

  it.runIf(phase === "granted")("D–G. one small USDC transfer is sent, confirmed and visible on Monad", { timeout: TIMEOUT }, async () => {
    const before = await readUsdcBalance(chain, recipient);
    const signer = createPrivySigner(config(), client());
    const { hash } = await signer.sendTransaction(walletId(), { chainId: MONAD_TESTNET_CHAIN_ID, to: MONAD_TESTNET_USDC_ADDRESS, data: encodeUsdcTransfer(recipient, amount) }, runKey("D"));
    record("transfer", { hash, explorer: explorerTxUrl(hash), amountUnits: amount.toString() });

    const receipt = await chain.waitForTransactionReceipt({ hash, timeout: 120_000 });
    record("transferReceipt", { status: receipt.status, blockNumber: receipt.blockNumber.toString() });
    expect(receipt.status).toBe("success");
    expect(getAddress(receipt.from)).toBe(wallet);
    expect(getAddress(receipt.to!)).toBe(MONAD_TESTNET_USDC_ADDRESS);

    const transfers = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs }).filter(
      (log) => getAddress(log.address) === MONAD_TESTNET_USDC_ADDRESS
    );
    expect(transfers).toHaveLength(1);
    expect(transfers[0].args).toMatchObject({ from: wallet, to: recipient, value: amount });
    expect(await readUsdcBalance(chain, recipient)).toBe(before + amount);
  });

  it.runIf(phase === "granted")("H. a recipient outside the allowlist is refused by Privy", { timeout: TIMEOUT }, async () => {
    const outsider = env.SPIKE_UNAUTHORIZED_RECIPIENT ? address("SPIKE_UNAUTHORIZED_RECIPIENT") : getAddress("0x000000000000000000000000000000000000dEaD");
    expect(allowlist().map((a) => a.toLowerCase())).not.toContain(outsider.toLowerCase());
    await expectRefused(chain, wallet, () => rawSend({ to: MONAD_TESTNET_USDC_ADDRESS, data: encodeUsdcTransfer(outsider, BigInt(1)) }, runKey("H")));
  });

  it.runIf(phase === "granted")("I. an amount above the policy cap is refused by Privy", { timeout: TIMEOUT }, async () => {
    await expectRefused(chain, wallet, () => rawSend({ to: MONAD_TESTNET_USDC_ADDRESS, data: encodeUsdcTransfer(recipient, cap + BigInt(1)) }, runKey("I")));
  });

  it.runIf(phase === "granted")("J. a native MON transfer is refused by Privy", { timeout: TIMEOUT }, async () => {
    await expectRefused(chain, wallet, () => rawSend({ to: recipient, value: "0x1", data: "0x" }, runKey("J")));
  });

  it.runIf(phase === "granted")("K. approve() on USDC is refused by Privy", { timeout: TIMEOUT }, async () => {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [recipient, BigInt(1)] });
    await expectRefused(chain, wallet, () => rawSend({ to: MONAD_TESTNET_USDC_ADDRESS, data }, runKey("K")));
  });

  it.runIf(phase === "granted")("L. the same idempotency key does not send twice", { timeout: TIMEOUT }, async () => {
    const before = await readUsdcBalance(chain, recipient);
    const signer = createPrivySigner(config(), client());
    const send = () => signer.sendTransaction(walletId(), { chainId: MONAD_TESTNET_CHAIN_ID, to: MONAD_TESTNET_USDC_ADDRESS, data: encodeUsdcTransfer(recipient, amount) }, runKey("L"));

    const first = await send();
    let second: { hash: Hex } | undefined;
    let secondError: unknown;
    try {
      second = await send();
    } catch (e) {
      secondError = e;
    }
    record("idempotency", { firstHash: first.hash, secondHash: second?.hash ?? null, secondRefused: Boolean(secondError) });
    // Either Privy replays the first response, or it refuses the duplicate. It must never send a second transfer.
    if (second) expect(second.hash).toBe(first.hash);
    else expect(secondError).toBeInstanceOf(APIError);

    const receipt = await chain.waitForTransactionReceipt({ hash: first.hash, timeout: 120_000 });
    expect(receipt.status).toBe("success");
    expect(await readUsdcBalance(chain, recipient)).toBe(before + amount);
  });

  it.runIf(phase === "revoked")("N. after the user removed the signer, Privy shows no Auctra signer and refuses execution", { timeout: TIMEOUT }, async () => {
    const privyWallet = await client().wallets().get(walletId());
    expect(privyWallet.additional_signers.some((s) => s.signer_id === env.PRIVY_SIGNER_ID)).toBe(false);
    await expectRefused(chain, wallet, () => rawSend({ to: MONAD_TESTNET_USDC_ADDRESS, data: encodeUsdcTransfer(recipient, amount) }, runKey("N")));
    record("revoked", { refused: true });
  });
});
