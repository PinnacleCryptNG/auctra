import { describe, expect, it } from "vitest";
import { formatUsdcAmount, parseUsdcAmount } from "../lib/usdc";

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
