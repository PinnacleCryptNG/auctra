export default function Home() {
  return (
    <main className="min-h-screen bg-[#0B0D0F] text-[#F5F6F4]">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 font-mono text-sm uppercase tracking-[0.2em] text-[#35D07F]">
          Auctra
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
          Tell Auctra what you want your money to do.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-[#667078]">
          An autonomous financial agent for recurring and conditional onchain money movement.
          Built for Monad Testnet.
        </p>
      </section>
    </main>
  );
}
