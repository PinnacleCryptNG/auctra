// Unit tests for Auctra's session-signer policy and the checks around it.
// No Privy calls: Privy's wallet/policy records are plain objects shaped like
// the @privy-io/node `Wallet` and `Policy` types. What Privy itself enforces
// is only proven by tests/integration/privy-transfer.integration.test.ts.

import { encodeFunctionData, erc20Abi, getAddress, type Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import { MONAD_TESTNET_USDC_ADDRESS, encodeUsdcTransfer } from "../lib/usdc";
import {
  DENIED_METHODS,
  assertUsdcTransferCall,
  buildTransferPolicyRules,
  buildUserOwnedTransferPolicy,
  expectedPolicyFingerprint,
  policyFingerprint,
  verifyWalletPermission,
  type PrivyPolicyState,
  type PrivyWalletState
} from "../lib/wallet/policy";

const SAVINGS = "0x2222222222222222222222222222222222222222";
const VENDOR = "0x3333333333333333333333333333333333333333";
const STRANGER = "0x9999999999999999999999999999999999999999";
const WALLET = "0x71C9a3F9c21B04de8A5C6F1E2d3b4A5968778992";
const SIGNER_ID = "auctra-key-quorum";
const USER_QUORUM = "user-owner-quorum";
const CAP = BigInt(100_000_000);
const limits = { recipients: [SAVINGS], maxUnits: CAP };

const transfer = (to: string, units: bigint) => encodeUsdcTransfer(getAddress(to), units);
const call = (over: Partial<{ chainId: number; to: string; data: Hex; value: bigint }> = {}) => ({
  chainId: 10143,
  to: MONAD_TESTNET_USDC_ADDRESS as string,
  data: transfer(SAVINGS, BigInt(1_000_000)),
  value: BigInt(0),
  ...over
});

describe("transfer policy rules (unit)", () => {
  const rules = buildTransferPolicyRules(limits);
  const allow = rules.filter((r) => r.action === "ALLOW");
  const condition = (field: string) => allow[0].conditions.find((c) => c.field === field);

  it("has exactly one ALLOW rule, for eth_sendTransaction", () => {
    expect(allow).toHaveLength(1);
    expect(allow[0].method).toBe("eth_sendTransaction");
  });

  it("pins chain 10143, the USDC contract, zero native value, recipient and cap", () => {
    expect(condition("chain_id")).toMatchObject({ field_source: "ethereum_transaction", operator: "eq", value: "10143" });
    expect(condition("to")).toMatchObject({ operator: "eq", value: "0x534b2f3A21130d7a60830c2Df862319e593943A3" });
    expect(condition("value")).toMatchObject({ operator: "lte", value: "0" });
    expect(condition("transfer.recipient")).toMatchObject({ field_source: "ethereum_calldata", operator: "in", value: [SAVINGS] });
    expect(condition("transfer.amount")).toMatchObject({ operator: "lte", value: "100000000" });
  });

  it("decodes calldata with transfer(address,uint256) only", () => {
    for (const field of ["transfer.recipient", "transfer.amount"]) {
      const abi = (condition(field) as unknown as { abi: Array<{ name: string; inputs: Array<{ type: string }> }> }).abi;
      expect(abi).toHaveLength(1);
      expect(abi[0].name).toBe("transfer");
      expect(abi[0].inputs.map((i) => i.type)).toEqual(["address", "uint256"]);
    }
  });

  it("explicitly denies native value, over-cap amounts and every other signing method", () => {
    const deny = rules.filter((r) => r.action === "DENY");
    expect(deny.some((r) => r.method === "eth_sendTransaction" && r.conditions.some((c) => c.field === "value" && c.operator === "gt"))).toBe(true);
    expect(deny.some((r) => r.method === "eth_sendTransaction" && r.conditions.some((c) => c.field === "transfer.amount" && c.operator === "gt"))).toBe(true);
    for (const method of ["exportPrivateKey", "exportSeedPhrase", "eth_signTransaction", "personal_sign", "eth_signTypedData_v4", "wallet_sendCalls", "eth_sign7702Authorization", "eth_signUserOperation"]) {
      expect(deny.some((r) => r.method === method && r.conditions.length === 0)).toBe(true);
    }
    expect(DENIED_METHODS).not.toContain("eth_sendTransaction");
  });

  it("refuses an empty allowlist, the USDC contract as a recipient, and a non-positive cap", () => {
    expect(() => buildTransferPolicyRules({ recipients: [], maxUnits: CAP })).toThrow();
    expect(() => buildTransferPolicyRules({ recipients: [MONAD_TESTNET_USDC_ADDRESS], maxUnits: CAP })).toThrow();
    expect(() => buildTransferPolicyRules({ recipients: [SAVINGS], maxUnits: BigInt(0) })).toThrow();
  });

  it("is owned by the Privy user, never by Auctra's key", () => {
    const policy = buildUserOwnedTransferPolicy({ name: "x", privyUserId: "did:privy:alice", ...limits });
    expect(policy.owner).toEqual({ user_id: "did:privy:alice" });
    expect(policy).not.toHaveProperty("owner_id");
    expect(() => buildUserOwnedTransferPolicy({ name: "x", privyUserId: "", ...limits })).toThrow();
  });

  it("fingerprints the limits: order and address case don't matter, a new destination does", () => {
    const a = expectedPolicyFingerprint({ recipients: [SAVINGS, VENDOR], maxUnits: CAP });
    expect(expectedPolicyFingerprint({ recipients: [VENDOR.toUpperCase().replace("0X", "0x"), SAVINGS], maxUnits: CAP })).toBe(a);
    expect(expectedPolicyFingerprint({ recipients: [SAVINGS], maxUnits: CAP })).not.toBe(a);
    expect(expectedPolicyFingerprint({ recipients: [SAVINGS, VENDOR], maxUnits: CAP + BigInt(1) })).not.toBe(a);
  });
});

describe("assertUsdcTransferCall (unit)", () => {
  it("accepts a capped USDC transfer to an allowlisted recipient on 10143", () => {
    expect(assertUsdcTransferCall(call(), limits)).toEqual({ recipient: getAddress(SAVINGS), amount: BigInt(1_000_000) });
  });

  it("requires chain 10143 and rejects Monad mainnet 143 and others", () => { // testnet-guard-ignore
    for (const chainId of [143, 1, 8453, 10144]) { // testnet-guard-ignore
      expect(() => assertUsdcTransferCall(call({ chainId }))).toThrow(expect.objectContaining({ code: "WRONG_CHAIN" }));
    }
  });

  it("accepts only the configured USDC contract", () => {
    expect(() => assertUsdcTransferCall(call({ to: STRANGER }))).toThrow(expect.objectContaining({ code: "UNSUPPORTED_ASSET" }));
    expect(() => assertUsdcTransferCall(call({ to: "not-an-address" }))).toThrow(expect.objectContaining({ code: "UNSUPPORTED_ASSET" }));
  });

  it("requires zero native value", () => {
    expect(() => assertUsdcTransferCall(call({ value: BigInt(1) }))).toThrow(expect.objectContaining({ code: "NATIVE_VALUE" }));
  });

  it("accepts only transfer(address,uint256): approve and other calls are rejected", () => {
    const approve = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [getAddress(SAVINGS), BigInt(1)] });
    const transferFrom = encodeFunctionData({ abi: erc20Abi, functionName: "transferFrom", args: [getAddress(WALLET), getAddress(SAVINGS), BigInt(1)] });
    for (const data of [approve, transferFrom, "0x" as Hex, "0xdeadbeef" as Hex, `${transfer(SAVINGS, BigInt(1))}00` as Hex]) {
      expect(() => assertUsdcTransferCall(call({ data }))).toThrow(expect.objectContaining({ code: "UNSUPPORTED_CALL" }));
    }
  });

  it("rejects recipients outside the allowlist and amounts above the cap or zero", () => {
    expect(() => assertUsdcTransferCall(call({ data: transfer(STRANGER, BigInt(1)) }), limits)).toThrow(expect.objectContaining({ code: "INVALID_DESTINATION" }));
    expect(() => assertUsdcTransferCall(call({ data: transfer(SAVINGS, CAP + BigInt(1)) }), limits)).toThrow(expect.objectContaining({ code: "INVALID_AMOUNT" }));
    expect(() => assertUsdcTransferCall(call({ data: transfer(SAVINGS, BigInt(0)) }), limits)).toThrow(expect.objectContaining({ code: "INVALID_AMOUNT" }));
  });
});

describe("verifyWalletPermission (unit, Privy records as plain objects)", () => {
  const POLICY_ID = "policy-123";
  const privyPolicy = (over: Partial<PrivyPolicyState> = {}): PrivyPolicyState => ({
    id: POLICY_ID,
    chain_type: "ethereum",
    owner_id: USER_QUORUM,
    // As Privy might echo it back: rule IDs/names added, addresses lower-cased.
    rules: buildTransferPolicyRules(limits).map((rule, i) => ({
      ...rule,
      id: `rule-${i}`,
      conditions: rule.conditions.map((c) =>
        typeof c.value === "string" ? { ...c, value: c.value.toLowerCase() } : { ...c, value: (c.value as string[]).map((v) => v.toLowerCase()) }
      )
    })) as PrivyPolicyState["rules"],
    ...over
  });
  const privyWallet = (over: Partial<PrivyWalletState> = {}): PrivyWalletState => ({
    id: "wallet-1",
    address: WALLET.toLowerCase(),
    chain_type: "ethereum",
    imported_at: null,
    archived_at: null,
    additional_signers: [{ signer_id: SIGNER_ID, override_policy_ids: [POLICY_ID] }],
    ...over
  });
  const expected = { privyWalletId: "wallet-1", address: WALLET, signerId: SIGNER_ID, policyId: POLICY_ID, limits };
  const verify = (wallet = privyWallet(), policy = privyPolicy(), exp = expected) => verifyWalletPermission({ wallet, policy, expected: exp });

  it("verifies Auctra's signer bound to the expected user-owned policy", () => {
    expect(verify()).toEqual({ ok: true, fingerprint: expectedPolicyFingerprint(limits) });
  });

  it("missing signer is not a permission", () => {
    expect(verify(privyWallet({ additional_signers: [] }))).toEqual({ ok: false, reason: "SIGNER_MISSING" });
    expect(verify(privyWallet({ additional_signers: [{ signer_id: "someone-else", override_policy_ids: [POLICY_ID] }] }))).toEqual({
      ok: false,
      reason: "SIGNER_MISSING"
    });
  });

  it("a signer without the policy, with another policy, or listed twice is refused", () => {
    for (const additional_signers of [
      [{ signer_id: SIGNER_ID }],
      [{ signer_id: SIGNER_ID, override_policy_ids: ["other-policy"] }],
      [{ signer_id: SIGNER_ID, override_policy_ids: [POLICY_ID] }, { signer_id: SIGNER_ID }]
    ]) {
      expect(verify(privyWallet({ additional_signers }))).toEqual({ ok: false, reason: "POLICY_NOT_ATTACHED" });
    }
  });

  it("a policy owned by Auctra's signer, or by nobody, is refused", () => {
    expect(verify(undefined, privyPolicy({ owner_id: SIGNER_ID }))).toEqual({ ok: false, reason: "POLICY_NOT_USER_OWNED" });
    expect(verify(undefined, privyPolicy({ owner_id: null }))).toEqual({ ok: false, reason: "POLICY_NOT_USER_OWNED" });
  });

  it("an extra ALLOW rule or different limits are refused", () => {
    const widened = privyPolicy();
    widened.rules = [...widened.rules, { method: "personal_sign", action: "ALLOW", conditions: [] }];
    expect(verify(undefined, widened)).toEqual({ ok: false, reason: "POLICY_MISMATCH" });

    const otherLimits = privyPolicy({ rules: buildTransferPolicyRules({ recipients: [SAVINGS, STRANGER], maxUnits: CAP }) as PrivyPolicyState["rules"] });
    expect(verify(undefined, otherLimits)).toEqual({ ok: false, reason: "POLICY_MISMATCH" });

    // Stale: the policy matched the old destinations, but the account now has another one.
    expect(verify(undefined, undefined, { ...expected, limits: { recipients: [SAVINGS, VENDOR], maxUnits: CAP } })).toEqual({ ok: false, reason: "POLICY_MISMATCH" });
  });

  it("a calldata condition decoded with a different ABI is refused", () => {
    const swapped = privyPolicy();
    swapped.rules = swapped.rules.map((r) => ({
      ...r,
      conditions: r.conditions.map((c) => (c.field_source === "ethereum_calldata" ? { ...c, abi: erc20Abi.filter((f) => f.type === "function" && f.name === "approve") } : c))
    })) as PrivyPolicyState["rules"];
    expect(policyFingerprint(swapped.rules)).not.toBe(expectedPolicyFingerprint(limits));
    expect(verify(undefined, swapped)).toEqual({ ok: false, reason: "POLICY_MISMATCH" });
  });

  it("imported (private-key) or archived wallets are refused", () => {
    expect(verify(privyWallet({ imported_at: 1_700_000_000 }))).toEqual({ ok: false, reason: "WALLET_IMPORTED" });
    expect(verify(privyWallet({ archived_at: 1_700_000_000 }))).toEqual({ ok: false, reason: "WALLET_IMPORTED" });
  });

  it("a different wallet is refused", () => {
    expect(verify(privyWallet({ id: "wallet-2" }))).toEqual({ ok: false, reason: "WALLET_MISMATCH" });
    expect(verify(privyWallet({ address: STRANGER }))).toEqual({ ok: false, reason: "WALLET_MISMATCH" });
  });
});

describe("Privy signer wrapper (unit, fake client)", () => {
  it("refuses a non-USDC-transfer call before anything reaches Privy", async () => {
    const { createPrivySigner } = await import("../lib/wallet/privy");
    const sendTransaction = vi.fn();
    const client = { wallets: () => ({ ethereum: () => ({ sendTransaction }) }) } as unknown as Parameters<typeof createPrivySigner>[1];
    const signer = createPrivySigner({ appId: "test-app-id", appSecret: "test-placeholder", authorizationPrivateKey: "test-placeholder" }, client);
    const approve = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [getAddress(SAVINGS), BigInt(1)] });

    await expect(signer.sendTransaction("wallet-1", { chainId: 10143, to: MONAD_TESTNET_USDC_ADDRESS, data: approve }, "key-1")).rejects.toMatchObject({ code: "UNSUPPORTED_CALL" });
    await expect(signer.sendTransaction("wallet-1", { chainId: 10143, to: getAddress(STRANGER), data: transfer(SAVINGS, BigInt(1)) }, "key-2")).rejects.toMatchObject({ code: "UNSUPPORTED_ASSET" });
    expect(sendTransaction).not.toHaveBeenCalled();
  });
});
