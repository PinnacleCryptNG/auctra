import { getAddress, isAddress, type Address, type Hex } from "viem";
import { AuctraConfig } from "../config";
import { MONAD_TESTNET_CHAIN_ID } from "../network";
import { MONAD_TESTNET_USDC_ADDRESS, encodeUsdcTransfer, parseUsdcAmount } from "../usdc";

// The only path from Auctra to a signing wallet. Every financial execution goes
// through executeUsdcTransfer(); nothing else may call a WalletSigner.

export type ExecutionRejectionCode =
  | "WRONG_CHAIN"
  | "UNSUPPORTED_ASSET"
  | "INVALID_SOURCE"
  | "INVALID_DESTINATION"
  | "INVALID_AMOUNT"
  | "INSUFFICIENT_BALANCE"
  | "MISSING_IDEMPOTENCY_KEY";

export class ExecutionRejectedError extends Error {
  constructor(public readonly code: ExecutionRejectionCode, message: string) {
    super(message);
    this.name = "ExecutionRejectedError";
  }
}

export type UnsignedContractCall = {
  chainId: typeof MONAD_TESTNET_CHAIN_ID;
  to: Address;
  data: Hex;
};

export interface WalletSigner {
  sendTransaction(walletId: string, call: UnsignedContractCall, idempotencyKey: string): Promise<{ hash: Hex }>;
}

export type UsdcTransferRequest = {
  walletId: string;
  from: string;
  to: string;
  asset: string;
  amount: string;
  chainId: number;
  idempotencyKey: string;
};

export type UsdcTransferDeps = {
  signer: WalletSigner;
  readUsdcBalance: (owner: Address) => Promise<bigint>;
};

export async function executeUsdcTransfer(
  request: UsdcTransferRequest,
  { signer, readUsdcBalance }: UsdcTransferDeps
): Promise<{ txHash: Hex; units: bigint }> {
  if (request.chainId !== MONAD_TESTNET_CHAIN_ID) {
    throw new ExecutionRejectedError("WRONG_CHAIN", "Auctra MVP supports Monad Testnet only.");
  }
  if (request.asset !== "USDC") {
    throw new ExecutionRejectedError("UNSUPPORTED_ASSET", `Unsupported asset: ${request.asset}`);
  }
  if (!request.idempotencyKey) {
    throw new ExecutionRejectedError("MISSING_IDEMPOTENCY_KEY", "Every execution needs an idempotency key.");
  }
  if (!isAddress(request.from)) {
    throw new ExecutionRejectedError("INVALID_SOURCE", "Source wallet address is invalid.");
  }
  if (!isAddress(request.to)) {
    throw new ExecutionRejectedError("INVALID_DESTINATION", "Destination address is invalid.");
  }

  const from = getAddress(request.from);
  const to = getAddress(request.to);
  if (to === from || to === MONAD_TESTNET_USDC_ADDRESS) {
    throw new ExecutionRejectedError("INVALID_DESTINATION", "Destination cannot be the source wallet or the token contract.");
  }

  let units: bigint;
  try {
    units = parseUsdcAmount(request.amount);
  } catch (error) {
    throw new ExecutionRejectedError("INVALID_AMOUNT", (error as Error).message);
  }
  if (units > parseUsdcAmount(AuctraConfig.maxTransferUsdc)) {
    throw new ExecutionRejectedError("INVALID_AMOUNT", `Amount exceeds the ${AuctraConfig.maxTransferUsdc} USDC per-transfer cap.`);
  }

  const balance = await readUsdcBalance(from);
  if (balance < units) {
    throw new ExecutionRejectedError("INSUFFICIENT_BALANCE", "USDC balance is below the transfer amount.");
  }

  const { hash } = await signer.sendTransaction(
    request.walletId,
    { chainId: MONAD_TESTNET_CHAIN_ID, to: MONAD_TESTNET_USDC_ADDRESS, data: encodeUsdcTransfer(to, units) },
    request.idempotencyKey
  );

  return { txHash: hash, units };
}
