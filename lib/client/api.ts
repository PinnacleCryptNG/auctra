"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef } from "react";
import type { AutomationCondition, AutomationSchedule } from "../automation-types";

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

/** fetch() for Auctra's API with the Privy access token attached. */
export function useApi() {
  const { getAccessToken } = usePrivy();
  // Keep request/download stable even if Privy hands back a new function each
  // render; otherwise every consumer's effects would re-run in a loop.
  const tokenRef = useRef(getAccessToken);
  useEffect(() => {
    tokenRef.current = getAccessToken;
  }, [getAccessToken]);

  const request = useCallback(
    async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
      const token = await tokenRef.current();
      let response: Response;
      try {
        response = await fetch(path, {
          method: init.method ?? "GET",
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(init.body !== undefined ? { "content-type": "application/json" } : {})
          },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined
        });
      } catch {
        throw new ApiError("NETWORK", "Couldn't reach Auctra.", 0);
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new ApiError(data?.error?.code ?? "ERROR", data?.error?.message ?? "Something went wrong.", response.status);
      }
      return data as T;
    },
    []
  );

  const download = useCallback(
    async (path: string, filename: string) => {
      const token = await tokenRef.current();
      const response = await fetch(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new ApiError("DOWNLOAD", "Download failed.", response.status);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  return { request, download };
}

/**
 * Turns any API failure into copy a person can act on. Messages from
 * validation errors (HTTP 400) are written for users by the backend; server
 * and network failures are replaced with generic, honest copy.
 */
export function friendlyError(error: unknown, fallbackTitle = "That didn't work"): { title: string; description: string } {
  if (error instanceof ApiError) {
    if (error.status === 0) return { title: "Couldn't reach Auctra", description: "Check your connection and try again." };
    if (error.status === 401) return { title: "Your session ended", description: "Sign in again to continue." };
    if (error.status >= 500) return { title: "Something went wrong on our side", description: "Nothing was changed. Try again in a moment." };
    return { title: fallbackTitle, description: error.message };
  }
  return { title: fallbackTitle, description: "Try again in a moment." };
}

// ---- API models (shapes returned by app/api/**) ----

export type Me = {
  linked: boolean;
  user: { timezone: string } | null;
  account: { id: string; type: "INDIVIDUAL" | "BUSINESS"; businessName: string | null } | null;
  wallet: { address: string; signerStatus: "NOT_GRANTED" | "GRANTED" | "REVOKED"; balanceFloor: string | null } | null;
  limits: { maxTransferUsdc: string; dailyCapUsdc: string };
};

export type Destination = { id: string; label: string; address: string; category: string };

export type Automation = {
  id: string;
  status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
  amount: string;
  schedule: AutomationSchedule;
  timezone: string;
  conditions: AutomationCondition[];
  memo: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  executionCount: number;
  description: string;
  destination: Destination;
};

export type Execution = {
  id: string;
  status: "PENDING" | "SUBMITTED" | "CONFIRMED" | "FAILED" | "SKIPPED" | "REJECTED" | "UNKNOWN";
  trigger: "SCHEDULED" | "MANUAL";
  amount: string;
  createdAt: string;
  txHash: string | null;
  explorerUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  memo: string | null;
  destination: { label: string; category: string };
};

export type Balance = { network: string; address: string; usdc: string; mon: string };

export type AutomationPreview = {
  amount: string;
  asset: "USDC";
  destination: { label: string; address: string; category: string };
  schedule: AutomationSchedule;
  timezone: string;
  firstRunAt: string;
  condition: AutomationCondition | null;
  balanceFloor: string | null;
  memo: string | null;
  network: "Monad Testnet";
  chainId: number;
  wallet: { address: string };
};

export type PrepareResponse =
  | { kind: "confirm"; confirmationId: string; summary: string; preview: AutomationPreview }
  | { kind: "needs_destination"; address: string }
  | { kind: "clarify"; question: string }
  | { kind: "set_floor"; amount: string }
  | { kind: "unsupported"; message: string }
  | { kind: "not_a_request" };
