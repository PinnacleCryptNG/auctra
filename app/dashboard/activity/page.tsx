"use client";

import { useState } from "react";
import { PageHeader } from "@/components/auctra/app-shell";
import { ExecutionList } from "@/components/auctra/execution-list";
import { Resource } from "@/components/auctra/resource";
import { Button, Card, EmptyState, IconActivity, IconDownload, Notice } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { useAuctra } from "@/lib/client/auctra-data";

export default function ActivityPage() {
  const { me, executions, refresh } = useAuctra();
  const { download } = useApi();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  async function exportCsv() {
    setExporting(true);
    setExportError(false);
    try {
      await download("/api/executions?format=csv", "auctra-executions.csv");
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="History"
        description="Every transfer, newest first."
        actions={
          (executions.data?.length ?? 0) > 0 && (
            <Button variant="secondary" icon={<IconDownload />} onClick={exportCsv} loading={exporting} loadingLabel="Preparing CSV…">
              Export CSV
            </Button>
          )
        }
      />
      {exportError && (
        <div className="mb-4">
          <Notice tone="danger" title="The export didn't download">Try again in a moment.</Notice>
        </div>
      )}
      <Card>
        <Resource
          data={executions.data}
          loading={executions.loading}
          error={executions.error}
          loadingLabel="Loading your transfers…"
          errorTitle="Couldn't load your history"
          onRetry={() => refresh(["executions"])}
          empty={<EmptyState icon={<IconActivity />} title="No transfers yet" description="Runs will show up here." />}
        >
          {(items) => <ExecutionList executions={items} timezone={me.data?.user?.timezone} />}
        </Resource>
      </Card>
    </>
  );
}
