import { Logo } from "@/components/auctra/logo";

/** Shared shell for the privacy and terms pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cloud">
      <header className="mx-auto flex max-w-[48rem] items-center px-4 py-4 sm:px-6">
        <Logo />
      </header>
      <main className="mx-auto max-w-[48rem] px-4 pb-16 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        <p className="mt-2 text-sm text-slate">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-[0.9375rem] leading-relaxed text-ink-2 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
    </div>
  );
}
