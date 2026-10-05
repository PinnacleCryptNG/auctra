import { describe, expect, it } from "vitest";
import { formatUsdcAmount, parseUsdcAmount } from "../lib/usdc";
import { buildUsdcTransferPolicy } from "../lib/wallet/privy";

describe("parseUsdcAmount", () => {
  it("converts exact decimals to 6-decimal base units", () => {
    expect(parseUsdcAmount("20")).toBe(BigInt(20_000_000));
    expect(parseUsdcAmount("0.000001")).toBe(BigInt(1));
    expect(parseUsdcAmount("100.5")).toBe(BigInt(100_500_000));
  });

  it("rejects zero, negatives, excess precision and non-numbers", () => {
    for (const amount of ["0", "0.0", "-5", "1.0000001", "1e6", "1,000", " 1"]) {
      expect(() => parseUsdcAmount(amount)).toThrow();
    }
  });

  it("round-trips through formatUsdcAmount", () => {
    expect(formatUsdcAmount(parseUsdcAmount("42.25"))).toBe("42.25");
  });
});

describe("buildUsdcTransferPolicy", () => {
  it("pins chain, token contract, recipients and max amount", () => {
    const policy = buildUsdcTransferPolicy({
      name: "test",
      destinations: ["0x2222222222222222222222222222222222222222"],
      maxUnits: BigInt(25_000_000)
    });
    const conditions = policy.rules[0].conditions;

    expect(policy.rules[0].method).toBe("eth_sendTransaction");
    expect(conditions.find((c) => c.field === "chain_id")?.value).toBe("10143");
    expect(conditions.find((c) => c.field === "transfer.amount")?.value).toBe("25000000");
    expect(conditions.find((c) => c.field === "transfer.recipient")?.value).toEqual([
      "0x2222222222222222222222222222222222222222"
    ]);
  });

  it("refuses an empty destination allowlist", () => {
    expect(() => buildUsdcTransferPolicy({ name: "x", destinations: [], maxUnits: BigInt(1) })).toThrow();
  });
});
