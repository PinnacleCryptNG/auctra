/** The one network this build runs on, shown as a small pill with a live dot. */
export const CHAIN_NAME = "Monad Testnet";

export function ChainChip({ tone = "light", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  const dark = tone === "dark";
  return (
    <span
      title="Test USDC on Monad Testnet. No real money moves."
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap ${
        dark ? "border-obsidian-line bg-obsidian-2 text-cloud" : "border-line bg-surface text-ink"
      } ${className}`}
    >
      <span aria-hidden className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60 motion-reduce:hidden" />
        <span className={`relative inline-flex size-2 rounded-full ${dark ? "bg-signal" : "bg-signal-strong"}`} />
      </span>
      {CHAIN_NAME}
    </span>
  );
}
