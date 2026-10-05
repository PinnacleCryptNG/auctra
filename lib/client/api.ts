"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback } from "react";

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

/** fetch() for Auctra's API with the Privy access token attached. */
export function useApi() {
  const { getAccessToken } = usePrivy();

  const request = useCallback(
    async <T,>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
      const token = await getAccessToken();
      const response = await fetch(path, {
        method: init.method ?? "GET",
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(init.body !== undefined ? { "content-type": "application/json" } : {})
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new ApiError(data?.error?.code ?? "ERROR", data?.error?.message ?? "Something went wrong.", response.status);
      }
      return data as T;
    },
    [getAccessToken]
  );

  const download = useCallback(
    async (path: string, filename: string) => {
      const token = await getAccessToken();
      const response = await fetch(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new ApiError("ERROR", "Download failed.", response.status);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    [getAccessToken]
  );

  return { request, download };
}

export type Me = {
  linked: boolean;
  user: { timezone: string } | null;
  account: { id: string; type: "INDIVIDUAL" | "BUSINESS"; businessName: string | null } | null;
  wallet: { address: string; signerStatus: "NOT_GRANTED" | "GRANTED" | "REVOKED"; balanceFloor: string | null } | null;
  limits: { maxTransferUsdc: string; dailyCapUsdc: string };
};

export type Destination = { id: string; label: string; address: string; category: string };
