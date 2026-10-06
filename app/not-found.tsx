import { SiteFooter, SiteHeader } from "@/components/auctra/site-chrome";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-cloud">
      <div className="bg-ledger flex flex-1 flex-col">
        <SiteHeader />
        <main id="main" className="mx-auto flex w-full max-w-[78rem] flex-1 flex-col justify-center gap-6 px-4 py-20 sm:px-6 lg:px-10">
          <p
            aria-hidden="true"
            className="font-display text-[clamp(6rem,4rem+12vw,14rem)] leading-[0.85] font-medium tracking-[-0.05em] text-obsidian [font-variation-settings:'SOFT'_100,'WONK'_1,'opsz'_144]"
          >
            4<span className="text-flare italic">0</span>4
          </p>
          <h1 className="text-h1 max-w-[20ch] sm:text-[2.75rem]">
            This page wandered off. <span className="accent-italic">Your money didn&apos;t.</span>
          </h1>
          <p className="max-w-[34rem] text-ink-2">The link may be old or mistyped. Your automations keep running exactly as you set them.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/dashboard" size="lg">
              Go to your dashboard
            </ButtonLink>
            <ButtonLink href="/" size="lg" variant="secondary">
              Back to home
            </ButtonLink>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
