import { describe, expect, it } from "vitest";
import type { Me } from "../lib/client/api";
import { walletReadiness } from "../lib/client/readiness";

const limits = { maxTransferUsdc: "100", dailyCapUsdc: "250" };
const account = { id: "a", type: "INDIVIDUAL" as const, businessName: null };
const wallet = (signerStatus: "NOT_GRANTED" | "GRANTED" | "REVOKED") => ({ address: "0x1", chainId: 10143, signerStatus, balanceFloor: null });
const me = (over: Partial<Me>): Me => ({ linked: true, user: { timezone: "UTC" }, account: null, wallet: null, limits, ...over });

describe("walletReadiness (unit)", () => {
  it("distinguishes every step and never assumes authorization", () => {
    expect(walletReadiness(false, me({ account, wallet: wallet("GRANTED") }))).toBe("signed_out");
    expect(walletReadiness(true, null)).toBe("account_needed");
    expect(walletReadiness(true, me({ linked: false }))).toBe("account_needed");
    expect(walletReadiness(true, me({ account }))).toBe("wallet_pending");
    expect(walletReadiness(true, me({ account, wallet: wallet("NOT_GRANTED") }))).toBe("permission_needed");
    expect(walletReadiness(true, me({ account, wallet: wallet("REVOKED") }))).toBe("permission_needed");
    expect(walletReadiness(true, me({ account, wallet: wallet("GRANTED") }))).toBe("ready");
  });
});
