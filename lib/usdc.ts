import {
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient
} from "viem";

export const USDC_DECIMALS = 6;

// Circle testnet USDC on Monad Testnet (chain 10143). Verified on-chain by
// verifyUsdcContract() before any spike transfer; see docs/PRD.md §17.
export const MONAD_TESTNET_USDC_ADDRESS: Address = getAddress(
  "0x534b2f3A21130d7a60830c2Df862319e593943A3"
);

const USDC_AMOUNT_PATTERN = /^\d+(\.\d{1,6})?$/;

/** Converts an exact decimal USDC string (e.g. "20.5") to base units. */
export function parseUsdcAmount(amount: string): bigint {
  if (!USDC_AMOUNT_PATTERN.test(amount)) {
    throw new Error(`Invalid USDC amount: ${amount}`);
  }

  const units = parseUnits(amount, USDC_DECIMALS);
  if (units <= BigInt(0)) {
    throw new Error("USDC amount must be greater than zero.");
  }

  return units;
}

export function formatUsdcAmount(units: bigint): string {
  return formatUnits(units, USDC_DECIMALS);
}

export function encodeUsdcTransfer(to: Address, units: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, units] });
}

export async function readUsdcBalance(client: PublicClient, owner: Address): Promise<bigint> {
  return client.readContract({
    address: MONAD_TESTNET_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner]
  });
}

/** Fails closed unless the configured contract really is 6-decimal USDC. */
export async function verifyUsdcContract(client: PublicClient) {
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address: MONAD_TESTNET_USDC_ADDRESS, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: MONAD_TESTNET_USDC_ADDRESS, abi: erc20Abi, functionName: "decimals" })
  ]);

  if (symbol !== "USDC" || decimals !== USDC_DECIMALS) {
    throw new Error(
      `Contract ${MONAD_TESTNET_USDC_ADDRESS} is not 6-decimal USDC (symbol=${symbol}, decimals=${decimals}).`
    );
  }

  return { symbol, decimals };
}
