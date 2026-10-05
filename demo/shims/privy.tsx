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
export function useSigners() {
  return { addSigners: async () => ({ user: null }), removeSigners: async () => ({ user: null }) };
}
