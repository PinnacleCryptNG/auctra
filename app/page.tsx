import { ConfirmationCard } from "@/components/auctra/confirmation-card";
import { Logo } from "@/components/auctra/logo";
import { ButtonLink, IconArrowRight, IconCheck, IconShield, TestnetBadge } from "@/components/ui";
import type { AutomationPreview } from "@/lib/client/api";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
const START = BOT ? `https://t.me/${BOT}` : "/dashboard";
const START_LABEL = BOT ? "Start in Telegram" : "Try Auctra";

// A realistic example, rendered with the same component users confirm with.
const EXAMPLE: AutomationPreview = {
  amount: "20",
  asset: "USDC",
  destination: { label: "Savings wallet", address: "0x71C0ffee2541f0b3d9e8a7c6b5a4d3e2f1A0b92A", category: "SAVINGS" },
  schedule: { frequency: "WEEKLY", dayOfWeek: "FRIDAY", time: "18:00" },
  timezone: "UTC",
  firstRunAt: "2026-10-09T18:00:00.000Z",
  condition: null,
  balanceFloor: null,
  memo: null,
  network: "Monad Testnet",
  chainId: 10143,
  wallet: { address: "0x8A4e2c9D17b3F6a0E5c8d1B2a3F4e5D6c7B8a91F" }
};

const STEPS = [
  { title: "Say it in plain words", text: "Tell Auctra what should happen, in Telegram or on the web. Amount, recipient, when, and any condition." },
  { title: "Check what Auctra understood", text: "You see the exact amount, schedule, recipient and network as clear fields. Nothing runs until you confirm." },
  { title: "Auctra runs it on time", text: "Each run checks your balance and limits first, then sends. You get a message with the result every time." }
];

const SEGMENTS = [
  {
    title: "For individuals",
    items: ["Save 20 USDC every Friday at 6 PM", "Pay rent on the 1st of every month", "Only send if my balance is above 300 USDC", "Never let my wallet fall below 300 USDC"]
  },
  {
    title: "For businesses",
    items: ["Pay a vendor 80 USDC monthly, with an invoice memo", "Pay a contractor 100 USDC every Friday", "Sweep 50 USDC to reserve each Monday above 500", "Keep at least 1,000 USDC in the operating wallet"]
  }
];

const SAFETY = [
  "Auctra never asks for your seed phrase or private key. You keep your own wallet.",
  "It can only send USDC to destinations you've saved, within per-transfer and daily limits.",
  "Those limits are enforced twice: by Auctra and by your wallet provider.",
  "Every run ends as sent, skipped or blocked, and you're told which and why."
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-cloud">
      <div className="bg-obsidian text-cloud">
        <header className="mx-auto flex max-w-[76rem] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <Logo tone="light" />
          <nav aria-label="Primary" className="flex items-center gap-2">
            <a href="#how" className="hidden min-h-10 items-center rounded-[6px] px-3 text-sm text-cloud/70 hover:text-cloud md:inline-flex">
              How it works
            </a>
            <a href="#safety" className="hidden min-h-10 items-center rounded-[6px] px-3 text-sm text-cloud/70 hover:text-cloud md:inline-flex">
              Security
            </a>
            <ButtonLink href="/dashboard" size="sm" variant="on-dark">
              Sign in
            </ButtonLink>
          </nav>
        </header>

        <main id="main">
          <section className="mx-auto grid max-w-[76rem] items-center gap-10 px-4 pt-8 pb-16 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-16 lg:px-10 lg:pt-16 lg:pb-24">
            <div className="grid gap-6">
              <p className="text-meta text-cloud/60">Autonomous financial agent</p>
              <h1 className="text-display max-w-[14ch]">Tell Auctra what you want your money to do.</h1>
              <p className="max-w-[34rem] text-[1.0625rem] leading-relaxed text-cloud/75">
                Set up recurring and conditional USDC transfers by describing them in plain words. Auctra shows you exactly what it will
                do, then handles every run on schedule, for you or your business.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={START} size="lg" icon={<IconArrowRight />} className="flex-row-reverse">
                  {START_LABEL}
                </ButtonLink>
                <ButtonLink href="/dashboard" size="lg" variant="on-dark">
                  Open dashboard
                </ButtonLink>
              </div>
              <p className="flex flex-wrap items-center gap-2 text-sm text-cloud/60">
                <TestnetBadge /> Runs on Monad Testnet with test USDC only.
              </p>
            </div>

            <figure className="grid gap-3" aria-label="Example: a request and Auctra's confirmation">
              <div className="ml-auto max-w-[85%] rounded-[var(--radius-card)] rounded-br-[4px] bg-[#2b5278] px-4 py-2.5 text-[0.9375rem] text-cloud">
                Save 20 USDC to my savings wallet every Friday at 6 PM.
              </div>
              <div className="text-ink">
                <ConfirmationCard preview={EXAMPLE} />
              </div>
              <figcaption className="flex items-center gap-2 text-sm text-cloud/70">
                <IconCheck className="text-signal" />
                You confirm once. Auctra handles every Friday after that.
              </figcaption>
            </figure>
          </section>
        </main>
      </div>

      <section id="how" aria-labelledby="how-heading" className="mx-auto max-w-[76rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <h2 id="how-heading" className="text-h1">
          How it works
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <span className="text-data text-slate">0{index + 1}</span>
              <h3 className="mt-3 text-h2">{step.title}</h3>
              <p className="mt-2 text-secondary">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="who-heading" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[76rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
          <h2 id="who-heading" className="text-h1">
            Built for people and the businesses they run
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {SEGMENTS.map((segment) => (
              <div key={segment.title} className="rounded-[var(--radius-card)] border border-line p-5">
                <h3 className="text-h2">{segment.title}</h3>
                <ul className="mt-4 grid gap-3">
                  {segment.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[0.9375rem] text-ink-2">
                      <IconCheck className="mt-1 shrink-0 text-signal-ink" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="safety" aria-labelledby="safety-heading" className="mx-auto max-w-[76rem] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          <div className="grid content-start gap-3">
            <span className="grid size-11 place-items-center rounded-[var(--radius-control)] bg-obsidian text-xl text-signal">
              <IconShield />
            </span>
            <h2 id="safety-heading" className="text-h1">
              Your money moves only the way you said
            </h2>
            <p className="text-secondary">Auctra reads requests with AI, but every transfer is checked and sent by deterministic rules you can see.</p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line">
            {SAFETY.map((item) => (
              <li key={item} className="flex items-start gap-3 bg-surface p-5 text-[0.9375rem]">
                <IconCheck className="mt-1 shrink-0 text-signal-ink" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-obsidian text-cloud">
        <div className="mx-auto flex max-w-[76rem] flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <h2 className="text-h1 max-w-[24ch]">Describe it once. Auctra handles the rest.</h2>
          <ButtonLink href={START} size="lg" icon={<IconArrowRight />} className="flex-row-reverse">
            {START_LABEL}
          </ButtonLink>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[76rem] flex-col gap-3 px-4 py-8 text-sm text-slate sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <Logo />
        <p>Testnet software. Auctra moves test USDC on Monad Testnet only. Not financial advice.</p>
        <nav aria-label="Legal" className="flex gap-4">
          <a href="/privacy" className="hover:text-ink">
            Privacy
          </a>
          <a href="/terms" className="hover:text-ink">
            Terms
          </a>
        </nav>
      </footer>
    </div>
  );
}
