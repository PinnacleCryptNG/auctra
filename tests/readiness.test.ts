import { describe, expect, it } from "vitest";
import type { Me } from "../lib/client/api";
import { permissionCopy, walletReadiness } from "../lib/client/readiness";

type Permission = NonNullable<Me["wallet"]>["permission"];

const limits = { maxTransferUsdc: "100", dailyCapUsdc: "250" };
const account = { id: "a", type: "INDIVIDUAL" as const, businessName: null };
const wallet = (permission: Permission, signerStatus: "NOT_GRANTED" | "GRANTED" | "REVOKED" = "GRANTED") => ({
  address: "0x1",
  chainId: 10143,
  signerStatus,
  permission,
  balanceFloor: null
});
const me = (over: Partial<Me>): Me => ({ linked: true, user: { timezone: "UTC" }, account: null, wallet: null, limits, ...over });

describe("walletReadiness (unit)", () => {
  it("distinguishes every step and never assumes authorization", () => {
    expect(walletReadiness(false, me({ account, wallet: wallet("VERIFIED") }))).toBe("signed_out");
    expect(walletReadiness(true, null)).toBe("account_needed");
    expect(walletReadiness(true, me({ linked: false }))).toBe("account_needed");
    expect(walletReadiness(true, me({ account }))).toBe("wallet_pending");
    expect(walletReadiness(true, me({ account, wallet: wallet("VERIFIED") }))).toBe("ready");
  });

  it("missing, revoked and stale permission are not READY", () => {
    expect(walletReadiness(true, me({ account, wallet: wallet("NOT_GRANTED", "NOT_GRANTED") }))).toBe("permission_needed");
    expect(walletReadiness(true, me({ account, wallet: wallet("REVOKED", "REVOKED") }))).toBe("permission_needed");
    // signer_status says GRANTED, but the verified limits are out of date: still not ready.
    expect(walletReadiness(true, me({ account, wallet: wallet("STALE", "GRANTED") }))).toBe("permission_needed");
  });

  it("explains why permission is needed", () => {
    expect(permissionCopy("STALE").badge).toBe("Review needed");
    expect(permissionCopy("REVOKED").badge).toBe("Permission revoked");
    expect(permissionCopy("NOT_GRANTED").badge).toBe("Permission needed");
  });
});
