import Link from "next/link";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

const segments = [
  {
    title: "For individuals",
    examples: ["Save 20 USDC to my savings wallet every Friday at 6 PM.", "Never let my spending wallet fall below 300 USDC."]
  },
  {
    title: "For businesses",
    examples: ["Pay Acme Hosting 80 USDC on the 1st of every month, memo INV hosting.", "Move 50 USDC to our reserve every Monday if the balance is at least 500."]
  }
];

export default function Home() {
  return (
    <main className="min-h-screen bg-obsidian text-cloud">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 font-mono text-sm uppercase tracking-[0.2em] text-signal">Auctra</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">Tell Auctra what you want your money to do.</h1>
        <p className="mt-6 max-w-2xl text-lg text-slate">
          An autonomous financial agent for recurring and conditional USDC payments, for individuals and businesses. Describe it once
          in Telegram; Auctra confirms the details, then runs it on schedule within limits you control. Built for Monad Testnet.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {segments.map((segment) => (
            <div key={segment.title} className="rounded-[12px] border border-white/10 bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-slate">{segment.title}</h2>
              <ul className="space-y-2 text-sm">
                {segment.examples.map((example) => (
                  <li key={example}>&ldquo;{example}&rdquo;</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          {BOT && (
            <a href={`https://t.me/${BOT}`} className="rounded-[8px] bg-signal px-5 py-3 text-sm font-medium text-obsidian">
              Start in Telegram
            </a>
          )}
          <Link href="/dashboard" className="rounded-[8px] border border-white/15 px-5 py-3 text-sm font-medium">
            Open dashboard
          </Link>
        </div>

        <p className="mt-10 max-w-2xl text-xs text-slate">
          Testnet software using test USDC only. Auctra never asks for your seed phrase or private key; it uses scoped, revocable
          permission on your own Privy wallet, limited to your saved destinations.
        </p>
      </section>
    </main>
  );
}
