import type { Metadata } from "next";
import { LegalPage } from "@/components/auctra/legal-page";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms for using Auctra on Monad Testnet.",
  alternates: { canonical: "/terms" },
  // Set per page: these objects replace the root layout's rather than merging with it.
  openGraph: { type: "website", siteName: "Auctra", title: "Terms & Conditions · Auctra", description: "The terms for using Auctra on Monad Testnet.", url: "/terms", images: "/opengraph-image" },
  twitter: { card: "summary_large_image", images: "/opengraph-image", title: "Terms & Conditions · Auctra", description: "The terms for using Auctra on Monad Testnet." }
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="October 6, 2026">
      <p>By using Auctra you agree to these terms. If you don&apos;t agree, please don&apos;t use it.</p>

      <h2>Testnet only</h2>
      <p>
        Auctra is experimental software that moves test USDC on Monad Testnet. Test tokens have no monetary value. Don&apos;t send real
        funds to an Auctra Wallet.
      </p>

      <h2>Your wallet and your instructions</h2>
      <p>
        Your Auctra Wallet is created and secured by Privy, and you own it. Auctra only acts within the permission and limits you
        approve, and only after you confirm each automation. You&apos;re responsible for checking the amount, recipient and schedule
        before you confirm.
      </p>

      <h2>No warranty</h2>
      <p>
        Auctra is provided as is, without warranties of any kind. Runs can be skipped, delayed or fail, for example when a network,
        wallet provider or balance check doesn&apos;t allow them. Auctra is not financial advice.
      </p>

      <h2>Limitation of liability</h2>
      <p>To the extent the law allows, the Auctra team is not liable for any loss arising from your use of the service.</p>

      <h2>Acceptable use</h2>
      <p>Don&apos;t use Auctra to break the law, to abuse or overload the service, or to access other people&apos;s accounts.</p>

      <h2>Changes</h2>
      <p>We may update these terms. The date at the top shows when they last changed.</p>
    </LegalPage>
  );
}
