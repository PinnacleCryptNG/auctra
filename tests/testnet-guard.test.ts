import { describe, expect, it } from "vitest";
import { assertMonadTestnet } from "../lib/network";
import { findMainnetViolations } from "../scripts/check-testnet-only";

describe("assertMonadTestnet", () => {
  it("accepts only chain 10143", () => {
    expect(() => assertMonadTestnet(10143)).not.toThrow();
    expect(() => assertMonadTestnet(143)).toThrow("Monad Testnet only"); // testnet-guard-ignore
  });
});

describe("findMainnetViolations", () => {
  const scan = (line: string) => findMainnetViolations("x.ts", line).map((v) => v.label);

  it("flags mainnet chain IDs, CAIP-2 IDs, chain imports and USDC address", () => {
    expect(scan("const chainId = 143;")).toContain("Monad mainnet chain ID 143"); // testnet-guard-ignore
    expect(scan('const caip2 = "eip155:143";')).toContain("Monad mainnet CAIP-2 ID"); // testnet-guard-ignore
    expect(scan('import { monad } from "viem/chains";')).toContain("viem mainnet `monad` chain import"); // testnet-guard-ignore
    expect(scan("0x754704Bc059F8C67012fEd69BC8A327a5aafb603")).toContain("Monad mainnet USDC address"); // testnet-guard-ignore
  });

  it("allows testnet references", () => {
    expect(scan("const chainId = 10143;")).toEqual([]);
    expect(scan('const caip2 = "eip155:10143";')).toEqual([]);
    expect(scan('import { monadTestnet } from "viem/chains";')).toEqual([]);
    expect(scan("const amount = 1.43;")).toEqual([]);
  });
});
