import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auctra — Autonomous Financial Agent",
  description: "Tell Auctra what you want your money to do. It handles the rest."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
