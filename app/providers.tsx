"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { monadTestnet } from "viem/chains";

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    // Lets the landing page render (and the app build) before Privy is configured.
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["telegram", "email"],
        appearance: { theme: "light", accentColor: "#35D07F" },
        // Testnet only: no network switch is exposed (PRD §20).
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } }
      }}
    >
      {children}
    </PrivyProvider>
  );
}
