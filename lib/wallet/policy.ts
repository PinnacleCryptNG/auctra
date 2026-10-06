import type { PolicyCondition, PolicyCreateParams, PolicyMethod } from "@privy-io/node/resources";
import { decodeFunctionData, erc20Abi, getAddress, isAddress, type Address, type Hex } from "viem";
import { MONAD_TESTNET_CHAIN_ID } from "../network";
import { sha256 } from "../services/hash";
import { MONAD_TESTNET_USDC_ADDRESS } from "../usdc";

// The Privy policy that bounds Auctra's session signer, and the checks that
// prove a wallet really carries it. See docs/FEASIBILITY-privy-monad.md §12.
//
// Ownership model:
// - The policy is OWNED BY THE USER (`owner: { user_id }`). Privy requires the
//   owner's authorization to update or delete it, so Auctra's server key cannot
//   widen its own limits.
// - Auctra never updates a policy. When the limits must change (a destination
//   is added or removed) Auctra creates a NEW user-owned policy and the user
//   re-approves it in the browser (`addSigners`). Until then the stored
//   permission is stale and nothing executes.
// - PRIVY_SIGNER_ID is only the session signer added to the wallet. It is
//   never the policy owner; verifyWalletPermission() rejects a policy it owns.

/** Only `transfer(address,uint256)` from the ERC-20 ABI. */
export const ERC20_TRANSFER_ABI = erc20Abi.filter((item) => item.type === "function" && item.name === "transfer");

/**
 * Wallet methods with an explicit DENY rule for Auctra's signer. Explicit
 * because whether Privy denies unmatched requests by default is not verified.
 * `eth_sendTransaction` itself is only reachable through the ALLOW rule, and
 * the DENY rules below catch the parts of it that can be expressed.
 */
export const DENIED_METHODS = ["personal_sign", "exportPrivateKey", "exportSeedPhrase"] as const satisfies readonly PolicyMethod[];

/**
 * Methods Privy refuses a condition-less rule for ("must have at least one
 * condition"), so they get no explicit DENY. They have no ALLOW rule either,
 * so they rely on Privy denying unmatched requests; the live spike checks that.
 */
export const UNRULED_METHODS = [
  "eth_signTransaction",
  "eth_signUserOperation",
  "eth_signTypedData_v4",
  "eth_sign7702Authorization",
  "wallet_sendCalls"
] as const satisfies readonly PolicyMethod[];

export type TransferPolicyLimits = {
  /** Saved, confirmed destinations. At least one. */
  recipients: string[];
  /** Per-transfer cap in USDC base units (6 decimals). */
  maxUnits: bigint;
};

type Rule = PolicyCreateParams.Rule;

function normalizeRecipients(recipients: string[]): Address[] {
  if (recipients.length === 0) throw new Error("A USDC transfer policy needs at least one allowlisted recipient.");
  const unique = new Set<Address>();
  for (const recipient of recipients) {
    if (!isAddress(recipient, { strict: false })) throw new Error(`Invalid recipient address: ${recipient}`);
    const address = getAddress(recipient);
    if (address === MONAD_TESTNET_USDC_ADDRESS) throw new Error("The USDC contract can't be a recipient.");
    unique.add(address);
  }
  return [...unique].sort();
}

/** The rules of Auctra's session-signer policy. Pure and deterministic. */
export function buildTransferPolicyRules({ recipients, maxUnits }: TransferPolicyLimits): Rule[] {
  if (maxUnits <= BigInt(0)) throw new Error("The per-transfer cap must be positive.");
  const allowlist = normalizeRecipients(recipients);
  const cap = maxUnits.toString();

  const allow: Rule = {
    name: "Allow capped USDC transfers to saved recipients",
    method: "eth_sendTransaction",
    action: "ALLOW",
    conditions: [
      { field_source: "ethereum_transaction", field: "chain_id", operator: "eq", value: String(MONAD_TESTNET_CHAIN_ID) },
      { field_source: "ethereum_transaction", field: "to", operator: "eq", value: MONAD_TESTNET_USDC_ADDRESS },
      { field_source: "ethereum_transaction", field: "value", operator: "lte", value: "0" },
      // Decoded with transfer(address,uint256) only: any other selector cannot match.
      { field_source: "ethereum_calldata", field: "transfer.recipient", abi: ERC20_TRANSFER_ABI, operator: "in", value: allowlist },
      { field_source: "ethereum_calldata", field: "transfer.amount", abi: ERC20_TRANSFER_ABI, operator: "lte", value: cap }
    ]
  };

  const denyNativeValue: Rule = {
    name: "Deny any native MON value",
    method: "eth_sendTransaction",
    action: "DENY",
    conditions: [{ field_source: "ethereum_transaction", field: "value", operator: "gt", value: "0" }]
  };

  const denyOverCap: Rule = {
    name: "Deny USDC transfers above the per-transfer cap",
    method: "eth_sendTransaction",
    action: "DENY",
    conditions: [{ field_source: "ethereum_calldata", field: "transfer.amount", abi: ERC20_TRANSFER_ABI, operator: "gt", value: cap }]
  };

  const denyMethods: Rule[] = DENIED_METHODS.map((method) => ({
    name: `Deny ${method}`,
    method,
    action: "DENY",
    conditions: []
  }));

  return [allow, denyNativeValue, denyOverCap, ...denyMethods];
}

/** Create-policy request for a policy owned by the Privy user (not by Auctra). */
export function buildUserOwnedTransferPolicy(input: TransferPolicyLimits & { name: string; privyUserId: string }): PolicyCreateParams {
  if (!input.privyUserId) throw new Error("A user-owned policy needs the Privy user ID.");
  return {
    version: "1.0",
    name: input.name.slice(0, 50),
    chain_type: "ethereum",
    owner: { user_id: input.privyUserId },
    rules: buildTransferPolicyRules(input)
  };
}

type ComparableCondition = { field_source: string; field: string; operator: string; value: string | string[]; abi?: unknown };
type ComparableRule = { method: string; action: string; conditions: ComparableCondition[] };

function normalizeValue(value: string | string[]): string | string[] {
  const one = (v: string) => (isAddress(v, { strict: false }) ? v.toLowerCase() : v);
  return Array.isArray(value) ? value.map(one).sort() : one(value);
}

function isTransferAbi(abi: unknown): boolean {
  if (!Array.isArray(abi) || abi.length !== 1) return false;
  const [fn] = abi as Array<{ type?: string; name?: string; inputs?: Array<{ type?: string }> }>;
  return fn?.type === "function" && fn.name === "transfer" && fn.inputs?.map((i) => i.type).join(",") === "address,uint256";
}

/** Canonical form of a rule set, ignoring rule names/IDs and address case. */
function canonicalRules(rules: readonly ComparableRule[]): string[] {
  return rules
    .map((rule) =>
      JSON.stringify({
        method: rule.method,
        action: rule.action,
        conditions: rule.conditions
          .map((c) => ({
            field_source: c.field_source,
            field: c.field,
            operator: c.operator,
            value: normalizeValue(c.value),
            // The calldata ABI must be exactly transfer(address,uint256).
            ...(c.field_source === "ethereum_calldata" ? { abi: isTransferAbi(c.abi) ? "erc20.transfer" : "OTHER" } : {})
          }))
          .map((c) => JSON.stringify(c))
          .sort()
      })
    )
    .sort();
}

/** Stable fingerprint of the limits a policy enforces. Not secret. */
export function policyFingerprint(rules: readonly ComparableRule[]): string {
  return sha256(JSON.stringify(canonicalRules(rules)));
}

export function expectedPolicyFingerprint(limits: TransferPolicyLimits): string {
  return policyFingerprint(buildTransferPolicyRules(limits) as ComparableRule[]);
}

/** The subset of Privy's Wallet / Policy objects that verification reads. */
export type PrivyWalletState = {
  id: string;
  address: string;
  chain_type: string;
  imported_at?: number | null;
  archived_at?: number | null;
  additional_signers: Array<{ signer_id: string; override_policy_ids?: string[] }>;
};
export type PrivyPolicyState = {
  id: string;
  chain_type: string;
  owner_id: string | null;
  rules: Array<{ method: string; action: string; conditions: PolicyCondition[] }>;
};

export type PermissionFailure =
  | "WALLET_MISMATCH"
  | "WALLET_IMPORTED"
  | "SIGNER_MISSING"
  | "POLICY_NOT_ATTACHED"
  | "POLICY_NOT_USER_OWNED"
  | "POLICY_MISMATCH";

export type PermissionCheck = { ok: true; fingerprint: string } | { ok: false; reason: PermissionFailure };

/**
 * Independently checks, from Privy's own records, that the wallet carries
 * Auctra's signer bound to exactly the expected user-owned policy. Anything
 * unexpected fails closed.
 */
export function verifyWalletPermission(input: {
  wallet: PrivyWalletState;
  /** null when it wasn't fetched because the wallet doesn't reference it. */
  policy: PrivyPolicyState | null;
  expected: { privyWalletId: string; address: string; signerId: string; policyId: string; limits: TransferPolicyLimits };
}): PermissionCheck {
  const { wallet, policy, expected } = input;
  const fail = (reason: PermissionFailure): PermissionCheck => ({ ok: false, reason });

  if (wallet.id !== expected.privyWalletId || wallet.chain_type !== "ethereum" || wallet.address.toLowerCase() !== expected.address.toLowerCase()) {
    return fail("WALLET_MISMATCH");
  }
  if (wallet.imported_at || wallet.archived_at) return fail("WALLET_IMPORTED");

  const signers = wallet.additional_signers.filter((s) => s.signer_id === expected.signerId);
  if (signers.length === 0) return fail("SIGNER_MISSING");
  // Exactly one entry for Auctra, bound to exactly the expected policy.
  if (signers.length !== 1 || signers[0].override_policy_ids?.length !== 1 || signers[0].override_policy_ids[0] !== expected.policyId) {
    return fail("POLICY_NOT_ATTACHED");
  }

  if (!policy || policy.id !== expected.policyId || policy.chain_type !== "ethereum") return fail("POLICY_MISMATCH");
  // Owned by someone, and not by Auctra's own signer: Auctra must not be able to rewrite it.
  if (!policy.owner_id || policy.owner_id === expected.signerId) return fail("POLICY_NOT_USER_OWNED");

  const fingerprint = expectedPolicyFingerprint(expected.limits);
  if (policyFingerprint(policy.rules as ComparableRule[]) !== fingerprint) return fail("POLICY_MISMATCH");

  return { ok: true, fingerprint };
}

export type TransferCallRejection = "WRONG_CHAIN" | "UNSUPPORTED_ASSET" | "NATIVE_VALUE" | "UNSUPPORTED_CALL" | "INVALID_DESTINATION" | "INVALID_AMOUNT";

export class TransferCallRejectedError extends Error {
  constructor(public readonly code: TransferCallRejection, message: string) {
    super(message);
    this.name = "TransferCallRejectedError";
  }
}

/**
 * Auctra's own mirror of the policy, applied to the exact call before it is
 * handed to Privy. Static checks always run; the allowlist and cap run when
 * the caller supplies them.
 */
export function assertUsdcTransferCall(
  call: { chainId: number; to: string; data: Hex; value?: bigint },
  limits?: Partial<TransferPolicyLimits>
): { recipient: Address; amount: bigint } {
  if (call.chainId !== MONAD_TESTNET_CHAIN_ID) throw new TransferCallRejectedError("WRONG_CHAIN", "Auctra only sends on Monad Testnet.");
  if (!isAddress(call.to, { strict: false }) || getAddress(call.to) !== MONAD_TESTNET_USDC_ADDRESS) {
    throw new TransferCallRejectedError("UNSUPPORTED_ASSET", "Auctra only calls the Monad Testnet USDC contract.");
  }
  if ((call.value ?? BigInt(0)) !== BigInt(0)) throw new TransferCallRejectedError("NATIVE_VALUE", "Auctra never sends native MON.");

  // transfer(address,uint256) selector, and nothing after the two arguments.
  if (!/^0xa9059cbb[0-9a-fA-F]{128}$/.test(call.data)) {
    throw new TransferCallRejectedError("UNSUPPORTED_CALL", "Only USDC transfer(address,uint256) is allowed.");
  }
  let recipient: Address;
  let amount: bigint;
  try {
    const decoded = decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: call.data });
    [recipient, amount] = decoded.args as readonly [Address, bigint];
  } catch {
    throw new TransferCallRejectedError("UNSUPPORTED_CALL", "Only USDC transfer(address,uint256) is allowed.");
  }

  if (amount <= BigInt(0)) throw new TransferCallRejectedError("INVALID_AMOUNT", "The amount must be positive.");
  if (limits?.maxUnits !== undefined && amount > limits.maxUnits) {
    throw new TransferCallRejectedError("INVALID_AMOUNT", "The amount is above the per-transfer cap.");
  }
  if (limits?.recipients && !limits.recipients.some((r) => r.toLowerCase() === recipient.toLowerCase())) {
    throw new TransferCallRejectedError("INVALID_DESTINATION", "The recipient isn't a saved destination.");
  }
  return { recipient: getAddress(recipient), amount };
}
