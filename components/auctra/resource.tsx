"use client";

import type { ReactNode } from "react";
import { Button, ErrorState, LoadingState } from "@/components/ui";
import { friendlyError } from "@/lib/client/api";

/** Loading → error (with retry) → empty → content, the same way everywhere. */
export function Resource<T>({
  data,
  loading,
  error,
  loadingLabel,
  errorTitle,
  onRetry,
  empty,
  children
}: {
  data: T[] | null;
  loading: boolean;
  error: unknown;
  loadingLabel: string;
  errorTitle: string;
  onRetry: () => void;
  empty: ReactNode;
  children: (items: T[]) => ReactNode;
}) {
  if (loading && !data) return <div className="px-4 py-3 sm:px-5"><LoadingState label={loadingLabel} /></div>;
  if (error && !data) {
    return (
      <div className="px-4 py-4 sm:px-5">
        <ErrorState
          title={errorTitle}
          description={friendlyError(error).description}
          action={<Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}
        />
      </div>
    );
  }
  if (!data || data.length === 0) return <>{empty}</>;
  return <>{children(data)}</>;
}
