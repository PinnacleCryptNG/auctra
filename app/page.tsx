import { ConfirmationCard } from "@/components/auctra/confirmation-card";
import { SiteFooter, SiteHeader, START_HREF, START_LABEL } from "@/components/auctra/site-chrome";
import { ButtonLink, IconArrowRight, IconCheck, IconShield, IconSkip, IconX } from "@/components/ui";
import type { AutomationPreview } from "@/lib/client/api";

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

const COMMANDS = [
  "Save 20 USDC every Friday at 6 PM",
  "Pay rent on the 1st",
  "Only send if I have more than 300",
  "Pay Ada 100 USDC every Friday",
  "Sweep 50 to reserve each Monday",
  "Never let my wallet drop below 300",
  "Pay the design studio 80 monthly, memo INV-2041"
];

const STEPS = [
  {
    tag: "Say it",
    title: "Type it like a text",
    text: "“Save 20 every Friday.” That's it."
  },
  {
    tag: "Check it",
    title: "Tap confirm",
    text: "Nothing runs until you say yes."
  },
  {
    tag: "Done",
    title: "Auctra handles it",
    text: "On time, with a receipt every run."
  }
];

const USE_CASES = [
  {
    who: "For you",
    title: "Save without thinking",
    items: ["Save 20 every Friday", "Pay rent on the 1st", "Keep 300 in my wallet"],
    tone: "signal" as const
  },
  {
    who: "For your business",
    title: "Bills that pay themselves",
    items: ["Pay my vendor 80 monthly", "Pay Ada 100 every Friday", "Sweep 50 to reserve on Mondays"],
    tone: "flare" as const
  }
];

const RECEIPTS = [
  { when: "Fri 18:00", what: "Sent 20 USDC to Savings wallet", status: "Sent", icon: <IconCheck />, tone: "bg-signal text-obsidian" },
  { when: "Mon 09:00", what: "Skipped: balance under 300", status: "Skipped", icon: <IconSkip />, tone: "bg-amber-soft text-amber-ink" },
  { when: "Tue 12:00", what: "Blocked: over daily limit", status: "Blocked", icon: <IconX />, tone: "bg-flare-soft text-flare-ink" }
];

const SAFETY = [
  { title: "Your keys stay yours", text: "We never ask for them." },
  { title: "Saved recipients only", text: "No surprise addresses." },
  { title: "Hard limits", text: "Per transfer and per day." },
  { title: "A receipt every run", text: "Sent, skipped or blocked." }
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-cloud">
      {/* Hero */}
      <div className="bg-grain relative overflow-hidden bg-obsidian text-cloud">
        <div aria-hidden="true" className="pointer-events-none absolute -top-40 -right-40 size-[34rem] rounded-full bg-flare/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-56 -left-40 size-[30rem] rounded-full bg-signal/15 blur-3xl" />
        <div className="relative">
          <SiteHeader tone="dark" />
          <main id="main">
            <section className="mx-auto grid max-w-[78rem] items-center gap-12 px-4 pt-8 pb-20 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,27rem)] lg:gap-16 lg:px-10 lg:pt-20 lg:pb-28">
              <div className="grid gap-7">
                <h1 className="text-display max-w-[13ch]">
                  Money that <span className="accent-italic">moves itself.</span>
                </h1>
                <p className="max-w-[34rem] text-[1.0625rem] leading-relaxed text-cloud/75">
                  Say it once. Auctra pays, saves and sweeps for you, on time, every time.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href={START_HREF} size="lg" icon={<IconArrowRight />} className="flex-row-reverse shadow-[4px_4px_0_0_var(--color-flare)]">
                    {START_LABEL}
                  </ButtonLink>
                  <ButtonLink href="/#how" size="lg" variant="on-dark">
                    See how it works
                  </ButtonLink>
                </div>
              </div>

              <figure className="relative grid gap-3" aria-label="Example: a request and Auctra's confirmation">
                <div className="ml-auto max-w-[85%] rounded-[20px] rounded-br-[6px] bg-flare px-4 py-2.5 text-[0.9375rem] font-medium text-obsidian">
                  Save 20 USDC to my savings wallet every Friday at 6 PM.
                </div>
                <div className="rotate-[-1.2deg] rounded-[var(--radius-surface)] bg-cloud p-1.5 text-ink shadow-[8px_8px_0_0_var(--color-signal)] transition-transform duration-300 hover:rotate-0">
                  <ConfirmationCard preview={EXAMPLE} />
                </div>
              </figure>
            </section>
          </main>
        </div>
      </div>

      {/* Command marquee */}
      <section aria-label="Things people ask Auctra to do" className="overflow-hidden border-y-2 border-obsidian bg-signal py-4 text-obsidian">
        <div className="flex w-max animate-marquee gap-10 motion-reduce:animate-none">
          {[...COMMANDS, ...COMMANDS].map((command, index) => (
            <span
              key={`${command}-${index}`}
              aria-hidden={index >= COMMANDS.length || undefined}
              className="flex items-center gap-10 font-display text-xl whitespace-nowrap italic [font-variation-settings:'SOFT'_100,'WONK'_1]"
            >
              “{command}”
              <span aria-hidden="true" className="size-2.5 rounded-full bg-flare" />
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" aria-labelledby="how-heading" className="bg-ledger scroll-mt-4">
        <div className="mx-auto max-w-[78rem] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <h2 id="how-heading" className="text-h1 max-w-[18ch] sm:text-[2.75rem]">
            Three steps. <span className="accent-italic">Then never again.</span>
          </h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="group relative rounded-[var(--radius-surface)] border-2 border-obsidian bg-surface p-6 shadow-pop transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-obsidian px-3 py-1 text-xs font-semibold tracking-wide text-cloud uppercase">{step.tag}</span>
                  <span className="font-display text-5xl leading-none text-flare italic [font-variation-settings:'SOFT'_100,'WONK'_1]">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-8 font-display text-2xl leading-tight font-medium tracking-[-0.01em]">{step.title}</h3>
                <p className="mt-3 text-secondary">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" aria-labelledby="use-cases-heading" className="scroll-mt-4 bg-surface">
        <div className="mx-auto max-w-[78rem] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <p className="text-meta">Use cases</p>
          <h2 id="use-cases-heading" className="text-h1 mt-3 max-w-[22ch] sm:text-[2.75rem]">
            For you. <span className="accent-italic">And your business.</span>
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {USE_CASES.map((useCase) => (
              <article
                key={useCase.who}
                className={`relative overflow-hidden rounded-[var(--radius-surface)] p-7 sm:p-9 ${
                  useCase.tone === "signal" ? "bg-signal text-obsidian" : "bg-obsidian text-cloud"
                }`}
              >
                <p className={`text-xs font-semibold tracking-[0.12em] uppercase ${useCase.tone === "signal" ? "text-obsidian/70" : "text-flare"}`}>
                  {useCase.who}
                </p>
                <h3 className="mt-3 max-w-[16ch] font-display text-3xl leading-[1.05] font-medium tracking-[-0.02em]">{useCase.title}</h3>
                <ul className="mt-7 grid gap-2.5">
                  {useCase.items.map((item) => (
                    <li
                      key={item}
                      className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-[0.9375rem] ${
                        useCase.tone === "signal" ? "bg-obsidian/[0.07]" : "bg-cloud/[0.07]"
                      }`}
                    >
                      <IconCheck className={`mt-1 shrink-0 ${useCase.tone === "signal" ? "text-obsidian" : "text-signal"}`} />
                      <span>“{item}”</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Safety */}
      <section id="safety" aria-labelledby="safety-heading" className="scroll-mt-4">
        <div className="mx-auto grid max-w-[78rem] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:px-10 lg:py-28">
          <div className="grid content-start gap-5">
            <span className="grid size-12 place-items-center rounded-2xl bg-obsidian text-xl text-signal">
              <IconShield />
            </span>
            <h2 id="safety-heading" className="text-h1 max-w-[16ch] sm:text-[2.75rem]">
              Moves <span className="accent-italic">only</span> the way you said.
            </h2>
            <div className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2">
              {SAFETY.map((item) => (
                <div key={item.title} className="bg-surface p-5">
                  <h3 className="text-h3">{item.title}</h3>
                  <p className="mt-1.5 text-secondary">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <figure aria-label="Example run receipts" className="self-center">
            <div className="rounded-[var(--radius-surface)] border-2 border-obsidian bg-surface p-5 shadow-pop sm:p-7">
              <div className="flex items-center justify-between border-b border-dashed border-line pb-4">
                <p className="font-display text-xl font-medium">This week&apos;s receipts</p>
                <span className="text-data text-slate">3 runs</span>
              </div>
              <ul className="divide-y divide-dashed divide-line">
                {RECEIPTS.map((receipt) => (
                  <li key={receipt.when} className="flex items-center gap-4 py-4">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-full text-lg ${receipt.tone}`}>{receipt.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.9375rem] font-medium">{receipt.what}</p>
                      <p className="text-data text-slate">{receipt.when}</p>
                    </div>
                    <span className="hidden text-xs font-semibold tracking-wide text-slate uppercase sm:inline">{receipt.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </figure>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-20 sm:px-6 lg:px-10">
        <div className="relative mx-auto max-w-[78rem] overflow-hidden rounded-[32px] bg-flare px-6 py-14 text-obsidian sm:px-12 sm:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -bottom-24 size-80 rounded-full border-[40px] border-obsidian/10" />
          <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-[16ch] font-display text-[clamp(2.25rem,1.5rem+3vw,4rem)] leading-[1] font-medium tracking-[-0.03em] [font-variation-settings:'SOFT'_100,'WONK'_1]">
              Say it once. <em className="italic">Auctra remembers.</em>
            </h2>
            <ButtonLink href={START_HREF} size="lg" variant="dark" icon={<IconArrowRight />} className="flex-row-reverse">
              {START_LABEL}
            </ButtonLink>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
