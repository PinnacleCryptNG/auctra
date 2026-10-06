import type { Metadata } from "next";
import { LegalPage } from "@/components/auctra/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Auctra collects, why, and who it shares it with.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 6, 2026">
      <p>
        Auctra is testnet software that runs USDC automations on Monad Testnet. This page explains what we collect to do that, and who
        helps us run it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your Privy user ID. Privy, not Auctra, holds the email or other login you sign in with.</li>
        <li>Your Telegram user and chat IDs, if you use Auctra from Telegram.</li>
        <li>Your Auctra Wallet address and the permission you grant Auctra on it. We never see or store its private keys.</li>
        <li>Your account type and business name, if you add one.</li>
        <li>The destinations, automations and limits you save, your timezone, and the history of every run.</li>
        <li>The plain-language requests you type, so we can turn them into an automation for you to confirm.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Only to run the service: signing you in, showing you your automations, running them on schedule, and telling you how each run
        went. We don&apos;t sell your data or use it for advertising.
      </p>

      <h2>Who processes it</h2>
      <ul>
        <li>Privy, for sign-in and your embedded wallet.</li>
        <li>Neon, which hosts our database, and Vercel, which hosts the app.</li>
        <li>Telegram, if you use the Auctra bot.</li>
        <li>Anthropic, which reads the requests you type so Auctra can understand them.</li>
        <li>Monad Testnet, where transfers are public on the blockchain, like any onchain transaction.</li>
      </ul>

      <h2>Cookies and storage</h2>
      <p>
        Auctra only uses the cookies and browser storage needed to keep you signed in. We don&apos;t use analytics or advertising
        cookies.
      </p>

      <h2>Your choices</h2>
      <p>
        You can revoke Auctra&apos;s permission on your wallet at any time in Settings, which stops every automation. To have your
        account data deleted, contact us and we&apos;ll remove it. Onchain transactions can&apos;t be deleted by anyone.
      </p>

      <h2>Contact</h2>
      <p>Questions about privacy can be sent to the Auctra team through the Telegram bot or the project&apos;s GitHub repository.</p>
    </LegalPage>
  );
}
