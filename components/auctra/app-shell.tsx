"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Address, Button, IconActivity, IconHome, IconLogout, IconPlus, IconRepeat, IconSettings } from "@/components/ui";
import { useAuctra } from "@/lib/client/auctra-data";
import { CreateAutomationDialog } from "./create-automation";
import { ChainChip } from "./chain-chip";
import { Logo } from "./logo";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: IconHome },
  { href: "/dashboard/automations", label: "Automations", icon: IconRepeat },
  { href: "/dashboard/activity", label: "Activity", icon: IconActivity },
  { href: "/dashboard/settings", label: "Settings", icon: IconSettings }
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

/**
 * Desktop (≥1024px): fixed sidebar with navigation, the primary action and
 * the wallet. Below that: a compact top bar with the primary action, and a
 * bottom tab bar within thumb reach.
 */
export function AppShell({ children, onSignOut }: { children: ReactNode; onSignOut: () => void }) {
  const pathname = usePathname();
  const { me, openCreate } = useAuctra();
  const account = me.data?.account;
  const wallet = me.data?.wallet;
  const accountName = account?.type === "BUSINESS" ? account.businessName : "Personal account";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only z-50 rounded-[var(--radius-control)] bg-obsidian px-3 py-2 text-cloud focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="bg-grain sticky top-0 hidden h-dvh flex-col bg-obsidian text-cloud lg:flex">
        <div className="grid justify-items-start gap-3 px-5 pt-5 pb-4">
          <Logo href="/dashboard" tone="light" />
          <ChainChip tone="dark" />
        </div>
        <div className="px-4">
          <Button className="w-full" icon={<IconPlus />} onClick={() => openCreate()}>
            Create automation
          </Button>
        </div>
        <nav aria-label="Main" className="mt-5 px-3">
          <ul className="grid gap-0.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm transition-colors ${
                      active ? "bg-cloud font-semibold text-obsidian" : "text-cloud/70 hover:bg-obsidian-2 hover:text-cloud"
                    }`}
                  >
                    <Icon className={`text-lg ${active ? "text-obsidian" : "text-cloud/50 [--icon-dot:var(--color-cloud)]"}`} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto grid gap-3 px-4 py-4">
          <div className="grid gap-2 rounded-[var(--radius-card)] bg-cloud p-4 text-ink">
            <p className="text-meta">Signed in as</p>
            <p className="truncate font-display text-lg leading-tight font-medium">{accountName}</p>
            {wallet && <Address value={wallet.address} label="Wallet address" />}
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm text-cloud/60 hover:bg-obsidian-2 hover:text-cloud"
          >
            <IconLogout className="text-base" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile / tablet top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-cloud/90 px-4 py-2 backdrop-blur-md pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-2">
            <ChainChip className="hidden min-[360px]:inline-flex" />
            <Button size="sm" icon={<IconPlus />} onClick={() => openCreate()} aria-label="Create automation">
              <span className="hidden min-[400px]:inline">Create</span>
            </Button>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[72rem] flex-1 px-4 pt-5 pb-28 focus:outline-none sm:px-6 sm:pt-7 lg:px-10 lg:pt-10 lg:pb-12">
          {children}
        </main>

        {/* Mobile / tablet bottom navigation */}
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-obsidian-line bg-obsidian pb-[env(safe-area-inset-bottom)] text-cloud lg:hidden">
          <ul className="mx-auto grid max-w-lg grid-cols-4">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium ${active ? "text-cloud" : "text-cloud/55"}`}
                  >
                    {/* The active tab's dot lights up in chartreuse. */}
                    <Icon className={`text-[1.375rem] ${active ? "[--icon-dot:var(--color-signal)]" : ""}`} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <CreateAutomationDialog />
    </div>
  );
}

/** Page heading row: title (h1), optional description and actions. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 lg:mb-8">
      <div className="grid min-w-0 gap-1">
        <h1 className="text-h1">{title}</h1>
        {description && <p className="text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
