import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { selectEmbeddedWallet, validateWalletMetadata } from "../lib/wallet/metadata";

const ADDRESS = "0x71c9a3f9c21b04de8a5c6f1e2d3b4a5968778992";
const valid = { privyWalletId: "cm1abc23def456", address: ADDRESS, chainId: 10143 };

describe("validateWalletMetadata (unit)", () => {
  it("accepts Monad Testnet (10143) and checksums the address", () => {
    expect(validateWalletMetadata(valid)).toEqual({
      privyWalletId: "cm1abc23def456",
      address: getAddress(ADDRESS),
      chainId: 10143
    });
  });

  it("rejects Monad Mainnet 143", () => { // testnet-guard-ignore
    expect(() => validateWalletMetadata({ ...valid, chainId: 143 })).toThrowError(expect.objectContaining({ code: "WRONG_CHAIN" })); // testnet-guard-ignore
  });

  it("rejects any other chain", () => {
    for (const chainId of [1, 8453, 0, -1, 10144, Number.NaN]) {
      expect(() => validateWalletMetadata({ ...valid, chainId })).toThrowError(expect.objectContaining({ code: "WRONG_CHAIN" }));
    }
  });

  it("rejects malformed wallet IDs and addresses", () => {
    for (const privyWalletId of ["", "has space", "a".repeat(129), "semi;colon"]) {
      expect(() => validateWalletMetadata({ ...valid, privyWalletId })).toThrowError(expect.objectContaining({ code: "INVALID_WALLET" }));
    }
    for (const address of ["", "0x123", "not-an-address", `${ADDRESS}00`]) {
      expect(() => validateWalletMetadata({ ...valid, address })).toThrowError(expect.objectContaining({ code: "INVALID_WALLET" }));
    }
  });

  it("returns only safe metadata fields", () => {
    const result = validateWalletMetadata({ ...valid, ...({ privateKey: "0xdead", seedPhrase: "x" } as object) } as typeof valid);
    expect(Object.keys(result).sort()).toEqual(["address", "chainId", "privyWalletId"]);
  });
});

describe("selectEmbeddedWallet (unit)", () => {
  const base = { id: "w1", address: ADDRESS, chain_type: "ethereum", archived_at: null, imported_at: null };

  it("picks the embedded EVM wallet", () => {
    expect(selectEmbeddedWallet([base])?.id).toBe("w1");
  });

  it("never uses imported-key, archived or non-EVM wallets", () => {
    expect(selectEmbeddedWallet([{ ...base, imported_at: 1700000000 }])).toBeNull();
    expect(selectEmbeddedWallet([{ ...base, archived_at: 1700000000 }])).toBeNull();
    expect(selectEmbeddedWallet([{ ...base, chain_type: "solana" }])).toBeNull();
    expect(selectEmbeddedWallet([{ ...base, id: "imp", imported_at: 1 }, { ...base, id: "ok" }])?.id).toBe("ok");
    expect(selectEmbeddedWallet([])).toBeNull();
  });
});
