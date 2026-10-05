import Link from "next/link";

/** Wordmark: a small signal-green mark plus "Auctra". */
export function Logo({ href = "/", tone = "dark" }: { href?: string; tone?: "dark" | "light" }) {
  return (
    <Link href={href} className={`inline-flex min-h-10 items-center gap-2 rounded-[6px] ${tone === "light" ? "text-cloud" : "text-ink"}`}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <rect width="24" height="24" rx="6" fill="#35D07F" />
        <path d="M7 16.5L12 7l5 9.5M9.2 13h5.6" stroke="#0B0D0F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="text-[1.0625rem] font-semibold tracking-[-0.01em]">Auctra</span>
    </Link>
  );
}
