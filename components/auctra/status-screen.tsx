import type { ReactNode } from "react";
import { TestnetBadge } from "@/components/ui";
import { Logo } from "./logo";

/** Full-page centred state: sign in, loading, setup needed, configuration errors. */
export function StatusScreen({ children }: { children: ReactNode }) {
  return (
    <div className="bg-ledger flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Logo />
        <TestnetBadge />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-enter">{children}</div>
      </main>
    </div>
  );
}
