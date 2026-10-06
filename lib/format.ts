import { DateTime } from "luxon";
import { parseUnits } from "viem";
import { USDC_DECIMALS, formatUsdcAmount } from "./usdc";

/** "20.000000" (numeric column) → "20". */
export function formatUsdc(amount: string) {
  return formatUsdcAmount(parseUnits(amount, USDC_DECIMALS));
}

export function formatDateTime(date: Date, timezone: string) {
  return DateTime.fromJSDate(date, { zone: timezone }).toFormat("ccc d LLL yyyy, HH:mm");
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
