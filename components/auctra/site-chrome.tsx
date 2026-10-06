import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { Logo, LogoMark } from "./logo";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
export const START_HREF = BOT ? `https://t.me/${BOT}` : "/dashboard";
export const START_LABEL = BOT ? "Start in Telegram" : "Start automating";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#use-cases", label: "Use cases" },
  { href: "/#safety", label: "Safety" }
];

/** Marketing header. `tone="dark"` sits on the aubergine hero; `"light"` on paper pages. */
export function SiteHeader({ tone = "light" }: { tone?: "dark" | "light" }) {
  const dark = tone === "dark";
  return (
    <header className="mx-auto flex w-full max-w-[78rem] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
      <Logo tone={dark ? "light" : "dark"} />
      <nav aria-label="Primary" className="flex items-center gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`hidden min-h-10 items-center rounded-full px-3.5 text-sm font-medium transition-colors md:inline-flex ${
              dark ? "text-cloud/75 hover:bg-obsidian-2 hover:text-cloud" : "text-ink-2 hover:bg-slate-soft hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <ButtonLink href="/dashboard" size="sm" variant={dark ? "on-dark" : "secondary"} className="ml-1">
          Sign in
        </ButtonLink>
      </nav>
    </header>
  );
}

/** Marketing footer: big wordmark, links, and the testnet note. */
export function SiteFooter() {
  return (
    <footer className="bg-grain relative overflow-hidden bg-obsidian text-cloud">
      <div className="mx-auto grid max-w-[78rem] gap-12 px-4 pt-16 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:px-10">
        <div className="grid content-start gap-5">
          <Logo tone="light" />
          <p className="max-w-[30rem] text-[0.9375rem] leading-relaxed text-cloud/70">
            Auctra is an autonomous money agent. Describe a transfer once, approve the limits, and it runs on schedule, inside the rules
            you set.
          </p>
          <div>
            <ButtonLink href={START_HREF} size="md">
              {START_LABEL}
            </ButtonLink>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <nav aria-label="Product" className="grid content-start gap-2.5">
            <p className="text-meta text-cloud/50">Product</p>
            <Link href="/#how" className="text-cloud/80 hover:text-signal">
              How it works
            </Link>
            <Link href="/#use-cases" className="text-cloud/80 hover:text-signal">
              Use cases
            </Link>
            <Link href="/#safety" className="text-cloud/80 hover:text-signal">
              Safety
            </Link>
            <Link href="/dashboard" className="text-cloud/80 hover:text-signal">
              Dashboard
            </Link>
          </nav>
          <nav aria-label="Legal" className="grid content-start gap-2.5">
            <p className="text-meta text-cloud/50">Legal</p>
            <Link href="/privacy" className="text-cloud/80 hover:text-signal">
              Privacy
            </Link>
            <Link href="/terms" className="text-cloud/80 hover:text-signal">
              Terms
            </Link>
          </nav>
        </div>
      </div>
      <div className="mx-auto flex max-w-[78rem] flex-col gap-3 border-t border-obsidian-line px-4 py-6 text-xs text-cloud/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <p>© {new Date().getFullYear()} Auctra. Testnet software: test USDC on Monad Testnet only. Not financial advice.</p>
        <p className="inline-flex items-center gap-2">
          <LogoMark className="size-4" /> Built for people who&apos;d rather not remember the 1st of the month.
        </p>
      </div>
      <p
        aria-hidden="true"
        className="pointer-events-none -mb-[0.14em] px-2 text-center font-display text-[clamp(5rem,22vw,19rem)] leading-[0.8] font-semibold tracking-[-0.05em] text-obsidian-2 select-none [font-variation-settings:'SOFT'_100,'WONK'_1,'opsz'_144]"
      >
        auctra
      </p>
    </footer>
  );
}
