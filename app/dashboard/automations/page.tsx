"use client";

import { AutomationCard } from "@/components/auctra/automation-card";
import { PageHeader } from "@/components/auctra/app-shell";
import { Resource } from "@/components/auctra/resource";
import { Button, Card, EmptyState, IconPlus, IconRepeat } from "@/components/ui";
import { useAuctra } from "@/lib/client/auctra-data";

export default function AutomationsPage() {
  const { automations, refresh, openCreate } = useAuctra();
  const all = automations.data;
  const live = all?.filter((a) => a.status === "ACTIVE" || a.status === "PAUSED") ?? null;
  const past = all?.filter((a) => a.status === "CANCELLED" || a.status === "COMPLETED") ?? [];
  const onChanged = () => refresh(["automations", "executions", "balance"]);

  return (
    <>
      <PageHeader
        title="Automations"
        description="Recurring and conditional transfers Auctra runs for you."
        actions={<Button icon={<IconPlus />} onClick={() => openCreate()}>Create automation</Button>}
      />
      <Resource
        data={live}
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
              description="Tell Auctra what you want your money to do and it becomes an automation."
              action={<Button icon={<IconPlus />} onClick={() => openCreate()}>Create automation</Button>}
            />
          </Card>
        }
      >
        {(items) => (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {items.map((a) => (
              <AutomationCard key={a.id} automation={a} onChanged={onChanged} />
            ))}
          </div>
        )}
      </Resource>

      {past.length > 0 && (
        <details className="group mt-8">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-h2 [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="text-slate transition-transform group-open:rotate-90">›</span>
            Past automations <span className="text-secondary font-normal">({past.length})</span>
          </summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {past.map((a) => (
              <AutomationCard key={a.id} automation={a} onChanged={onChanged} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}
