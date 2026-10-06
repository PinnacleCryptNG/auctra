"use client";

import Link from "next/link";
import { AutomationCard } from "@/components/auctra/automation-card";
import { PageHeader } from "@/components/auctra/app-shell";
import { ExecutionList } from "@/components/auctra/execution-list";
import { Resource } from "@/components/auctra/resource";
import { WalletSummary } from "@/components/auctra/wallet-summary";
import { Button, ButtonLink, Card, CardHeader, EmptyState, IconActivity, IconArrowRight, IconPlus, IconRepeat, Notice } from "@/components/ui";
import { useAuctra } from "@/lib/client/auctra-data";
import { permissionCopy } from "@/lib/client/readiness";

const PROMPTS = {
  INDIVIDUAL: ["Save 20 USDC to my savings wallet every Friday at 6 PM", "Never let my wallet fall below 300 USDC"],
  BUSINESS: ["Pay Acme Hosting 80 USDC on the 1st of every month at 9:00", "Pay Ada Obi 100 USDC every Friday at 5 PM"]
};

export default function OverviewPage() {
  const { me, balance, automations, executions, refresh, openCreate } = useAuctra();
  const data = me.data!;
  const accountType = data.account?.type ?? "INDIVIDUAL";
  const live = (automations.data ?? []).filter((a) => a.status === "ACTIVE" || a.status === "PAUSED");
  const name = accountType === "BUSINESS" ? data.account?.businessName : null;

  return (
    <>
      <PageHeader title="Overview" description={name ? `${name} · business account` : "Personal account"} />

      <div className="grid gap-6">
        {data.wallet && data.wallet.permission !== "VERIFIED" && (
          <Notice
            tone="warning"
            title={permissionCopy(data.wallet.permission).title}
            action={<ButtonLink href="/onboarding" size="sm" variant="secondary">{permissionCopy(data.wallet.permission).action}</ButtonLink>}
          >
            {permissionCopy(data.wallet.permission).description}
          </Notice>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <WalletSummary
            me={data}
            balance={balance.data}
            balanceLoading={balance.loading}
            balanceError={balance.error}
            onRetry={() => refresh(["balance"])}
          />

          <Card aria-labelledby="create-heading" className="flex flex-col p-4 sm:p-5">
            <h2 id="create-heading" className="text-h2">
              Tell Auctra what you want your money to do
            </h2>
            <p className="mt-1 text-secondary">Just say what you want. You confirm before anything runs.</p>
            <button
              type="button"
              onClick={() => openCreate()}
              className="mt-4 flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-input)] border border-line bg-cloud/60 px-3 text-left text-sm text-slate hover:border-slate/50"
            >
              <IconPlus className="shrink-0 text-lg text-ink-2" />
              <span className="truncate">{PROMPTS[accountType][0]}</span>
            </button>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Examples">
              {PROMPTS[accountType].map((prompt) => (
                <li key={prompt} className="min-w-0 max-w-full">
                  <button
                    type="button"
                    onClick={() => openCreate(prompt)}
                    className="min-h-10 max-w-full truncate rounded-[var(--radius-control)] border border-line px-3 text-left text-xs text-ink-2 hover:bg-cloud"
                  >
                    {prompt}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-4">
              <Button icon={<IconPlus />} onClick={() => openCreate()} className="w-full sm:w-auto">
                Create automation
              </Button>
            </div>
          </Card>
        </div>

        <section aria-labelledby="active-heading" className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="active-heading" className="text-h2">
              Active automations
            </h2>
            {live.length > 0 && <SeeAll href="/dashboard/automations" label="View all automations" />}
          </div>
          <Resource
            data={automations.data ? live : null}
            loading={automations.loading}
            error={automations.error}
            loadingLabel="Loading your automations…"
            errorTitle="Couldn't load your automations"
            onRetry={() => refresh(["automations"])}
            empty={
              <Card>
                <EmptyState
                  icon={<IconRepeat />}
                  title="No automations yet"
                  description="Say it once. Auctra handles the rest."
                  action={<Button icon={<IconPlus />} onClick={() => openCreate()}>Create automation</Button>}
                />
              </Card>
            }
          >
            {(items) => (
              <div className="grid gap-4 md:grid-cols-2">
                {items.slice(0, 4).map((a) => (
                  <AutomationCard key={a.id} automation={a} onChanged={() => refresh(["automations", "executions", "balance"])} />
                ))}
              </div>
            )}
          </Resource>
        </section>

        <Card aria-labelledby="recent-heading">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
            <h2 id="recent-heading" className="text-h2">
              Recent activity
            </h2>
            {(executions.data?.length ?? 0) > 0 && <SeeAll href="/dashboard/activity" label="View all activity" />}
          </div>
          <div className="mt-3 border-t border-line">
            <Resource
              data={executions.data}
              loading={executions.loading}
              error={executions.error}
              loadingLabel="Loading recent transfers…"
              errorTitle="Couldn't load recent activity"
              onRetry={() => refresh(["executions"])}
              empty={<EmptyState icon={<IconActivity />} title="No transfers yet" description="Runs will show up here." />}
            >
              {(items) => <ExecutionList executions={items.slice(0, 5)} timezone={data.user?.timezone} />}
            </Resource>
          </div>
        </Card>
      </div>
    </>
  );
}

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center gap-1 rounded-[6px] px-1 text-sm font-medium text-ink-2 hover:text-ink">
      <span aria-hidden="true">View all</span>
      <span className="sr-only">{label}</span>
      <IconArrowRight />
    </Link>
  );
}
