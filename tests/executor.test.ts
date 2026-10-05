import { decodeFunctionData, erc20Abi, type Address } from "viem";
import { describe, expect, it, vi } from "vitest";
import { MONAD_TESTNET_USDC_ADDRESS } from "../lib/usdc";
import { ExecutionRejectedError, executeUsdcTransfer, type UsdcTransferRequest, type WalletSigner } from "../lib/wallet/executor";

const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";

function validRequest(overrides: Partial<UsdcTransferRequest> = {}): UsdcTransferRequest {
  return {
    walletId: "wallet-1",
    from: FROM,
    to: TO,
    asset: "USDC",
    amount: "20",
    chainId: 10143,
    idempotencyKey: "automation-1:2026-10-09T18:00:00.000Z",
    ...overrides
  };
}

function deps(balance = BigInt(100_000_000)) {
  const signer: WalletSigner = { sendTransaction: vi.fn().mockResolvedValue({ hash: "0xabc" }) };
  const readUsdcBalance = vi.fn(async (_owner: Address) => balance);
  return { signer, readUsdcBalance };
}

async function expectRejection(request: UsdcTransferRequest, code: string, balance?: bigint) {
  const d = deps(balance);
  await expect(executeUsdcTransfer(request, d)).rejects.toMatchObject({ name: "ExecutionRejectedError", code });
  expect(d.signer.sendTransaction).not.toHaveBeenCalled();
}

describe("executeUsdcTransfer", () => {
  it("sends a USDC transfer call to the USDC contract with the idempotency key", async () => {
    const d = deps();
    const result = await executeUsdcTransfer(validRequest(), d);

    expect(result).toEqual({ txHash: "0xabc", units: BigInt(20_000_000) });
    const [walletId, call, key] = vi.mocked(d.signer.sendTransaction).mock.calls[0];
    expect(walletId).toBe("wallet-1");
    expect(key).toBe("automation-1:2026-10-09T18:00:00.000Z");
    expect(call.chainId).toBe(10143);
    expect(call.to).toBe(MONAD_TESTNET_USDC_ADDRESS);
    expect(decodeFunctionData({ abi: erc20Abi, data: call.data })).toEqual({
      functionName: "transfer",
      args: [TO, BigInt(20_000_000)]
    });
  });

  it("rejects any chain other than Monad Testnet", async () => {
    await expectRejection(validRequest({ chainId: 143 }), "WRONG_CHAIN"); // testnet-guard-ignore
    await expectRejection(validRequest({ chainId: 1 }), "WRONG_CHAIN");
  });

  it("rejects unsupported assets", async () => {
    await expectRejection(validRequest({ asset: "MON" }), "UNSUPPORTED_ASSET");
  });

  it("rejects invalid or unsafe destinations", async () => {
    await expectRejection(validRequest({ to: "0x123" }), "INVALID_DESTINATION");
    await expectRejection(validRequest({ to: FROM }), "INVALID_DESTINATION");
    await expectRejection(validRequest({ to: MONAD_TESTNET_USDC_ADDRESS }), "INVALID_DESTINATION");
  });

  it("rejects invalid amounts", async () => {
    for (const amount of ["0", "-1", "1.1234567", "abc", "", "100.000001"]) {
      await expectRejection(validRequest({ amount }), "INVALID_AMOUNT");
    }
  });

  it("allows exactly the per-transfer cap", async () => {
    await expect(executeUsdcTransfer(validRequest({ amount: "100" }), deps())).resolves.toMatchObject({
      units: BigInt(100_000_000)
    });
  });

  it("rejects a missing idempotency key", async () => {
    await expectRejection(validRequest({ idempotencyKey: "" }), "MISSING_IDEMPOTENCY_KEY");
  });

  it("skips without sending when the balance is insufficient", async () => {
    await expectRejection(validRequest({ amount: "20" }), "INSUFFICIENT_BALANCE", BigInt(19_999_999));
  });

  it("raises ExecutionRejectedError instances", async () => {
    await expect(executeUsdcTransfer(validRequest({ asset: "DAI" }), deps())).rejects.toBeInstanceOf(
      ExecutionRejectedError
    );
  });
});
