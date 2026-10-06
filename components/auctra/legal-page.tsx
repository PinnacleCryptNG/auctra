import { SiteFooter, SiteHeader } from "@/components/auctra/site-chrome";

/** Shared shell for the privacy and terms pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cloud">
      <div className="bg-ledger border-b border-line">
        <SiteHeader />
        <div className="mx-auto max-w-[48rem] px-4 pt-10 pb-14 sm:px-6 sm:pt-16">
          <p className="text-meta">Legal</p>
          <h1 className="mt-3 font-display text-[clamp(2.5rem,1.8rem+3vw,4rem)] leading-[1] font-medium tracking-[-0.03em] [font-variation-settings:'SOFT'_100,'WONK'_1,'opsz'_144]">
            {title}
          </h1>
          <p className="mt-4 inline-flex rounded-full bg-signal-soft px-3 py-1 text-sm font-medium text-signal-ink">Last updated {updated}</p>
        </div>
      </div>
      <main id="main" className="mx-auto max-w-[48rem] px-4 py-12 pb-24 sm:px-6">
        <div className="space-y-6 text-[1rem] leading-relaxed text-ink-2 [&_a]:font-medium [&_a]:text-ink [&_a]:underline [&_a]:decoration-signal-strong [&_a]:decoration-2 [&_a]:underline-offset-4 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-[-0.01em] [&_h2]:text-ink [&_li]:mt-1.5 [&_li]:marker:text-ink [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
