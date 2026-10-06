// Privy stand-in for the sandbox: the demo account is already signed in and
// its wallet already exists. Signer grants are recorded by the sandbox API.
import type { ReactNode } from "react";
import { navigate } from "./router";

const getAccessToken = async () => "sandbox";

export function PrivyProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function usePrivy() {
  return { ready: true, authenticated: true, login() {}, logout: () => navigate("/"), getAccessToken, user: null };
}
// The sandbox's wallet is seeded on boot, so onboarding's wallet step is never
// reached there; these keep the shared onboarding page compiling and inert.
export function useWallets() {
  return { ready: true, wallets: [] as { address: string; walletClientType: string }[] };
}
export function useCreateWallet() {
  return { createWallet: async () => ({ address: "0x0000000000000000000000000000000000000000" }) };
}
export function useSigners() {
  return { addSigners: async () => ({ user: null }), removeSigners: async () => ({ user: null }) };
}
