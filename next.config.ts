import type { NextConfig } from "next";

// Applied to every response. No full Content-Security-Policy yet: Privy's
// embedded wallet loads frames and scripts from its own origins, so a strict
// CSP needs testing against the live login flow first.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The bot opens setup as a Telegram Mini App, which Telegram's web client shows in an iframe,
  // so framing is limited to Telegram rather than blocked (X-Frame-Options can't express that).
  { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org; base-uri 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" }
];

// Vercel may refuse NEXT_PUBLIC_ names, so the bot username can also be set as
// TELEGRAM_BOT_USERNAME; it's inlined for the browser either way.
const botUsername = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: botUsername },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;
