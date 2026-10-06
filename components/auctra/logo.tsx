import Link from "next/link";

/**
 * The Auctra mark: a chartreuse "A" on aubergine whose crossbar is a paper
 * dot, the moment an automation fires. Same drawing as app/icon.svg.
 */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1B1433" />
      <path d="M8.5 24.5 16 7.5l7.5 17" fill="none" stroke="#C5F04A" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="19.4" r="2.9" fill="#F5EFE4" />
    </svg>
  );
}

/** Mark plus the serif wordmark. `tone="light"` for dark backgrounds. */
export function Logo({ href = "/", tone = "dark" }: { href?: string; tone?: "dark" | "light" }) {
  return (
    <Link
      href={href}
      aria-label="Auctra home"
      className={`inline-flex min-h-10 items-center gap-2.5 rounded-[8px] ${tone === "light" ? "text-cloud" : "text-ink"}`}
    >
      <LogoMark className={`size-8 ${tone === "light" ? "rounded-[9px] ring-1 ring-cloud/15" : ""}`} />
      <span className="font-display text-[1.375rem] leading-none font-semibold tracking-[-0.02em] [font-variation-settings:'SOFT'_100,'opsz'_48]">
        Auctra
      </span>
    </Link>
  );
}
