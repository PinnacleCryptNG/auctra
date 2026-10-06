// The sandbox UI: the real Auctra pages and components from app/ and
// components/, plus a "Sandbox" panel for the simulated parts (clock, funds,
// account type) and the Telegram bot chat.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import ActivityPage from "../../app/dashboard/activity/page";
import AutomationsPage from "../../app/dashboard/automations/page";
import OverviewPage from "../../app/dashboard/page";
import SettingsPage from "../../app/dashboard/settings/page";
import OnboardingPage from "../../app/onboarding/page";
import Home from "../../app/page";
import { AppShell } from "../../components/auctra/app-shell";
import { Badge, Button, Dialog, IconPlus, IconSend, LoadingState, Notice } from "../../components/ui";
import { AuctraDataProvider, useAuctra } from "../../lib/client/auctra-data";
import { formatDateTime } from "../../lib/client/format";
import { navigate } from "../shims/router";
import { usePathname } from "../shims/next-navigation";
import {
  addFunds,
  boot,
  CHAT_EXAMPLES,
  DATA_CHANGED,
  jumpToNextRun,
  markChatRead,
  sandboxStore,
  sendChat,
  TIMEZONE,
  tapChatButton,
  type AccountType
} from "./engine";

export function SandboxApp() {
  const path = usePathname();
  const [generation, setGeneration] = useState(0);
  const [switching, setSwitching] = useState(false);

  async function switchAccount(type: AccountType) {
    setSwitching(true);
    await boot(type);
    setGeneration((g) => g + 1);
    setSwitching(false);
    navigate("/dashboard");
  }

  if (switching) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <LoadingState label="Setting up the demo account…" rows={0} />
      </div>
    );
  }

  let content;
  if (path === "/") content = <Home />;
  else if (path.startsWith("/onboarding")) content = <OnboardingPage />;
  else {
    const Page = path.startsWith("/dashboard/automations")
      ? AutomationsPage
      : path.startsWith("/dashboard/activity")
        ? ActivityPage
        : path.startsWith("/dashboard/settings")
          ? SettingsPage
          : OverviewPage;
    content = (
      <AuctraDataProvider key={generation}>
        <AccountReady>
          <AppShell onSignOut={() => navigate("/")}>
            <Page />
          </AppShell>
          <SandboxDock onSwitchAccount={switchAccount} />
        </AccountReady>
      </AuctraDataProvider>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-obsidian px-4 py-2 text-center text-xs text-cloud/80">
        <span className="font-medium text-cloud">Auctra sandbox</span>
        <span>Real app and payment engine in your browser. Wallet, chain and clock are simulated; no tokens move.</span>
        {path === "/" ? (
          <button type="button" className="font-medium text-signal underline-offset-2 hover:underline" onClick={() => navigate("/dashboard")}>
            Open the dashboard
          </button>
        ) : (
          <button type="button" className="font-medium text-signal underline-offset-2 hover:underline" onClick={() => navigate("/")}>
            View the landing page
          </button>
        )}
      </div>
      {content}
    </>
  );
}

/** Same rule as the dashboard layout: pages render once the account has loaded. */
function AccountReady({ children }: { children: React.ReactNode }) {
  const { me } = useAuctra();
  if (!me.data) {
    return (
      <div className="grid min-h-[80dvh] place-items-center px-4">
        <LoadingState label="Loading your account…" rows={0} />
      </div>
    );
  }
  return <>{children}</>;
}

/** Floating "Sandbox" button and panel: simulated controls + the Telegram bot. */
function SandboxDock({ onSwitchAccount }: { onSwitchAccount: (type: AccountType) => void }) {
  const state = useSyncExternalStore(sandboxStore.subscribe, sandboxStore.get, sandboxStore.get);
  const { refresh } = useAuctra();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"controls" | "telegram">("controls");
  const [message, setMessage] = useState<string | null>(null);

  // Keep the dashboard in step with changes made by the bot, the clock or funding.
  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(DATA_CHANGED, onChange);
    return () => window.removeEventListener(DATA_CHANGED, onChange);
  }, [refresh]);

  useEffect(() => {
    if (open && tab === "telegram") markChatRead();
  }, [open, tab, state.chat.length]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-card)] bg-obsidian px-4 text-sm font-medium text-cloud shadow-[var(--shadow-overlay)] hover:bg-obsidian-2 lg:bottom-6"
      >
        Sandbox
        {state.unread > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-signal px-1.5 text-xs text-obsidian">
            {state.unread}
            <span className="sr-only"> new Telegram messages</span>
          </span>
        )}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Sandbox" description="Drive the simulated parts, or talk to Auctra's Telegram bot." size="lg">
        <div role="tablist" aria-label="Sandbox" className="mb-5 grid grid-cols-2 gap-1 rounded-[var(--radius-control)] bg-cloud p-1">
          {(["controls", "telegram"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-10 rounded-[6px] text-sm font-medium ${tab === t ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-slate hover:text-ink"}`}
            >
              {t === "controls" ? "Controls" : "Telegram"}
              {t === "telegram" && state.unread > 0 && <span className="ml-1.5 text-signal-ink">•</span>}
            </button>
          ))}
        </div>

        {tab === "controls" ? (
          <div role="tabpanel" className="grid gap-6">
            <section className="grid gap-3">
              <h3 className="text-h3">Demo account</h3>
              <div className="grid grid-cols-2 gap-2">
                {(["INDIVIDUAL", "BUSINESS"] as const).map((type) => (
                  <Button
                    key={type}
                    variant={state.accountType === type ? "dark" : "secondary"}
                    aria-pressed={state.accountType === type}
                    onClick={() => {
                      setOpen(false);
                      onSwitchAccount(type);
                    }}
                  >
                    {type === "INDIVIDUAL" ? "Personal" : "Business"}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-slate">Switching starts over with fresh demo data.</p>
            </section>

            <section className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-h3">Demo clock</h3>
                <Badge>{formatDateTime(state.now.toISOString(), TIMEZONE)}</Badge>
              </div>
              <p className="text-sm text-ink-2">Move time forward to the next scheduled run. The real scheduler then runs, with every safety check.</p>
              <Button
                onClick={async () => {
                  setMessage(await jumpToNextRun());
                }}
                loading={state.busy}
                loadingLabel="Running the scheduler…"
              >
                Jump to next scheduled run
              </Button>
            </section>

            <section className="grid gap-3">
              <h3 className="text-h3">Wallet</h3>
              <p className="text-sm text-ink-2">Add simulated test USDC to try runs that would otherwise be skipped for a low balance.</p>
              <Button
                variant="secondary"
                icon={<IconPlus />}
                onClick={async () => {
                  await addFunds("100");
                  setMessage("Added 100 test USDC.");
                }}
              >
                Add 100 test USDC
              </Button>
            </section>

            {message && <Notice tone="success" title={message} />}
            <AiStatus mode={state.aiMode} />
          </div>
        ) : (
          <TelegramChat />
        )}
      </Dialog>
    </>
  );
}

function AiStatus({ mode }: { mode: string }) {
  if (mode === "live") return <p className="text-xs text-slate">Plain-English requests are read live by Claude, using your claude.ai account (it asks first).</p>;
  if (mode === "canned") return <p className="text-xs text-amber-ink">Live reading isn&apos;t available here, so only the example requests work. They use pre-recorded readings.</p>;
  return null;
}

function TelegramChat() {
  const state = useSyncExternalStore(sandboxStore.subscribe, sandboxStore.get, sandboxStore.get);
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [state.chat.length]);

  return (
    <div role="tabpanel" className="grid gap-3">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
        <div className="flex items-center gap-2 border-b border-line bg-cloud px-3 py-2">
          <span className="grid size-7 place-items-center rounded-full bg-signal text-xs font-semibold text-obsidian">A</span>
          <span className="text-sm font-medium">Auctra bot</span>
          <span className="text-xs text-slate">· same account as the dashboard</span>
        </div>
        <div ref={logRef} aria-live="polite" className="flex h-[min(24rem,45dvh)] flex-col gap-2 overflow-y-auto bg-surface p-3">
          {state.chat.map((line) =>
            line.from === "system" ? (
              <p key={line.id} className="self-center text-center text-xs text-slate">
                {line.text}
              </p>
            ) : (
              <div
                key={line.id}
                className={`max-w-[88%] rounded-[var(--radius-card)] px-3 py-2 text-sm ${
                  line.from === "user" ? "self-end rounded-br-[4px] bg-obsidian text-cloud" : "self-start rounded-bl-[4px] bg-cloud text-ink"
                }`}
              >
                <p className="break-words whitespace-pre-wrap">{line.text}</p>
                {line.keyboard && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {line.keyboard.inline_keyboard.flat().map((button) =>
                      "callback_data" in button ? (
                        <Button key={button.callback_data} size="sm" variant="secondary" disabled={state.busy} onClick={() => tapChatButton(line.id, button.callback_data, button.text)}>
                          {button.text}
                        </Button>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            )
          )}
          {state.busy && <p className="self-start text-xs text-slate">Auctra is typing…</p>}
        </div>
        <form
          className="flex gap-2 border-t border-line p-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = text;
            setText("");
            sendChat(value);
          }}
        >
          <label htmlFor="sandbox-chat" className="sr-only">
            Message Auctra
          </label>
          <input
            id="sandbox-chat"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message Auctra"
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-input)] border border-line px-3 text-[0.9375rem] focus:border-obsidian focus:outline-none"
          />
          <Button type="submit" icon={<IconSend />} disabled={state.busy || !text.trim()} aria-label="Send">
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2">
        {[...CHAT_EXAMPLES[state.accountType], "/automations", "/run", "/history"].map((example) => (
          <button
            key={example}
            type="button"
            disabled={state.busy}
            onClick={() => sendChat(example)}
            className={`min-h-10 max-w-full truncate rounded-[var(--radius-control)] border border-line px-3 text-left text-xs text-ink-2 hover:bg-cloud disabled:opacity-50 ${example.startsWith("/") ? "text-data" : ""}`}
          >
            {example}
          </button>
        ))}
      </div>
      <AiStatus mode={state.aiMode} />
    </div>
  );
}
