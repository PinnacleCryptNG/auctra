"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** Signs out and lands on the home page rather than the sign-in card. */
export function useSignOut() {
  const { logout } = usePrivy();
  const router = useRouter();
  return useCallback(async () => {
    router.replace("/");
    await logout();
  }, [logout, router]);
}
