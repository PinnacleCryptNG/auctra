import { Logo } from "@/components/auctra/logo";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-cloud">
      <header className="mx-auto w-full max-w-[76rem] px-4 py-4 sm:px-6 lg:px-10">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-[32rem] flex-1 flex-col items-start justify-center gap-4 px-4 pb-24 sm:px-6">
        <p className="text-sm font-medium text-slate">404</p>
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">This page doesn&apos;t exist</h1>
        <p className="text-ink-2">The link may be old or mistyped. Your automations are unaffected.</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/dashboard">Go to your dashboard</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Back to home
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}
