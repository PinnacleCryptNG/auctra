"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApi, type Automation, type Balance, type Destination, type Execution, type Me } from "./api";

// One place that loads the signed-in account's data for every dashboard page,
// so switching tabs is instant and every page sees the same state.

type Resource<T> = { data: T | null; loading: boolean; error: unknown };

type AuctraData = {
  me: Resource<Me>;
  balance: Resource<Balance>;
  automations: Resource<Automation[]>;
  destinations: Resource<Destination[]>;
  executions: Resource<Execution[]>;
  refresh: (what?: Array<"me" | "balance" | "automations" | "destinations" | "executions">) => Promise<void>;
  /** Opens the create-automation flow from anywhere in the app. */
  openCreate: (initialText?: string) => void;
  createRequest: { open: boolean; text: string };
  closeCreate: () => void;
};

const Context = createContext<AuctraData | null>(null);

const empty = <T,>(): Resource<T> => ({ data: null, loading: true, error: null });

export function AuctraDataProvider({ children }: { children: ReactNode }) {
  const { request } = useApi();
  const [me, setMe] = useState<Resource<Me>>(empty);
  const [balance, setBalance] = useState<Resource<Balance>>(empty);
  const [automations, setAutomations] = useState<Resource<Automation[]>>(empty);
  const [destinations, setDestinations] = useState<Resource<Destination[]>>(empty);
  const [executions, setExecutions] = useState<Resource<Execution[]>>(empty);
  const [createRequest, setCreateRequest] = useState({ open: false, text: "" });

  const load = useCallback(
    async <T,>(path: string, pick: (body: never) => T, set: (fn: (prev: Resource<T>) => Resource<T>) => void) => {
      set((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const body = await request<never>(path);
        set(() => ({ data: pick(body), loading: false, error: null }));
      } catch (error) {
        set((prev) => ({ ...prev, loading: false, error }));
      }
    },
    [request]
  );

  const refresh = useCallback<AuctraData["refresh"]>(
    async (what = ["me", "balance", "automations", "destinations", "executions"]) => {
      const tasks: Promise<void>[] = [];
      if (what.includes("me")) tasks.push(load<Me>("/api/me", (b) => b, setMe));
      if (what.includes("balance")) tasks.push(load<Balance>("/api/balance", (b) => b, setBalance));
      if (what.includes("automations"))
        tasks.push(load<Automation[]>("/api/automations", (b: { automations: Automation[] }) => b.automations, setAutomations));
      if (what.includes("destinations"))
        tasks.push(load<Destination[]>("/api/destinations", (b: { destinations: Destination[] }) => b.destinations, setDestinations));
      if (what.includes("executions"))
        tasks.push(load<Execution[]>("/api/executions", (b: { executions: Execution[] }) => b.executions, setExecutions));
      await Promise.all(tasks);
    },
    [load]
  );

  // After Privy sign-in, make sure the Auctra user exists, then load "me".
  // Account data loads only once onboarding is complete.
  useEffect(() => {
    (async () => {
      try {
        await request("/api/auth/session", { method: "POST" });
      } catch (error) {
        setMe({ data: null, loading: false, error });
        return;
      }
      await refresh(["me"]);
    })();
  }, [refresh, request]);

  const ready = Boolean(me.data?.account && me.data.wallet);
  useEffect(() => {
    if (ready) refresh(["balance", "automations", "destinations", "executions"]);
  }, [ready, refresh]);

  const value = useMemo<AuctraData>(
    () => ({
      me,
      balance,
      automations,
      destinations,
      executions,
      refresh,
      createRequest,
      openCreate: (text = "") => setCreateRequest({ open: true, text }),
      closeCreate: () => setCreateRequest((prev) => ({ ...prev, open: false }))
    }),
    [me, balance, automations, destinations, executions, refresh, createRequest]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuctra() {
  const value = useContext(Context);
  if (!value) throw new Error("useAuctra must be used inside AuctraDataProvider");
  return value;
}
