import type { Metadata, Viewport } from "next";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { siteUrl } from "@/lib/site";
import { Providers } from "./providers";

const DESCRIPTION = "Tell Auctra what you want your money to do. It handles the rest.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Auctra — Autonomous Financial Agent", template: "%s · Auctra" },
  description: DESCRIPTION,
  applicationName: "Auctra",
  openGraph: { type: "website", siteName: "Auctra", title: "Auctra — Autonomous Financial Agent", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "Auctra — Autonomous Financial Agent", description: DESCRIPTION }
};

export const viewport: Viewport = { themeColor: "#1B1433", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
