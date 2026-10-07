import { NextResponse } from "next/server";
import { registerWebhook } from "@/lib/telegram/api";

/**
 * Open once after adding the Telegram env vars: points the bot at this
 * deployment's webhook. Safe to repeat, and it only ever sets the webhook to
 * this app with the configured secret, so it needs no extra auth.
 */
export async function GET(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const missing = [!token && "TELEGRAM_BOT_TOKEN", !secret && "TELEGRAM_WEBHOOK_SECRET"].filter(Boolean);
  if (!token || !secret) {
    return NextResponse.json({ ok: false, message: `Add these in Vercel, redeploy, then open this page again: ${missing.join(", ")}` }, { status: 400 });
  }

  const url = `${new URL(request.url).origin}/api/telegram/webhook`;
  try {
    const result = await registerWebhook(token, { url, secret });
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: `Telegram said: ${result.description ?? "unknown error"}. Check TELEGRAM_BOT_TOKEN.` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, message: "Couldn't reach Telegram. Try again." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, message: "Telegram is connected. Send /start to your bot.", webhook: url });
}
