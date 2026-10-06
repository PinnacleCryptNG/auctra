"use client";

import { usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { AppShell } from "@/components/auctra/app-shell";
import { StatusScreen } from "@/components/auctra/status-screen";
import { Button, ButtonLink, Card, ErrorState, LoadingState } from "@/components/ui";
import { friendlyError } from "@/lib/client/api";
import { AuctraDataProvider, useAuctra } from "@/lib/client/auctra-data";
import { walletReadiness } from "@/lib/client/readiness";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    return (
      <StatusScreen>
        <ErrorState title="Sign-in isn't configured" description="This deployment is missing its Privy app ID, so the dashboard can't load." />
      </StatusScreen>
    );
  }
  return <AuthGate>{children}</AuthGate>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <StatusScreen>
        <LoadingState label="Connecting to Auctra…" rows={0} />
      </StatusScreen>
    );
  }
  if (!authenticated) {
    return (
      <StatusScreen>
        <Card className="p-6 sm:p-8">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <h1 className="text-h1">Sign in to Auctra</h1>
              <p className="text-secondary">Your money, on autopilot.</p>
            </div>
            <Button size="lg" onClick={login} className="w-full">
              Sign in
            </Button>
          </div>
        </Card>
      </StatusScreen>
    );
  }
  return (
    <AuctraDataProvider>
      <AccountGate>{children}</AccountGate>
    </AuctraDataProvider>
  );
}

function AccountGate({ children }: { children: ReactNode }) {
  const { logout } = usePrivy();
  const { me, refresh } = useAuctra();

  if (me.loading && !me.data) {
    return (
      <StatusScreen>
        <LoadingState label="Loading your account…" rows={0} />
      </StatusScreen>
    );
  }
  if (me.error && !me.data) {
    const { title, description } = friendlyError(me.error, "Couldn't load your account");
    return (
      <StatusScreen>
        <ErrorState title={title} description={description} action={<Button size="sm" variant="secondary" onClick={() => refresh(["me"])}>Try again</Button>} />
      </StatusScreen>
    );
  }
  const readiness = walletReadiness(true, me.data);
  if (readiness === "account_needed" || readiness === "wallet_pending") {
    return (
      <StatusScreen>
        <Card className="p-6 sm:p-8">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <h1 className="text-h1">{readiness === "account_needed" ? "Finish setting up" : "Connect your Auctra Wallet"}</h1>
              <p className="text-secondary">
                {readiness === "account_needed"
                  ? "A few quick steps and you're in."
                  : "Connect your Auctra Wallet to continue."}
              </p>
            </div>
            <ButtonLink href="/onboarding" size="lg" className="w-full">
              Continue setup
            </ButtonLink>
            <Button variant="ghost" onClick={logout}>
              Sign out
            </Button>
          </div>
        </Card>
      </StatusScreen>
    );
  }

  // "permission_needed" still opens the app, with a visible warning and no automatic sending.
  return <AppShell onSignOut={logout}>{children}</AppShell>;
}
