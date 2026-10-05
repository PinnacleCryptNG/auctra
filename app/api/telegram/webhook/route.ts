import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/app/http";
import { getBotDeps } from "@/lib/app/runtime";
import type { TelegramUpdate } from "@/lib/telegram/api";
import { handleUpdate } from "@/lib/telegram/bot";

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !safeEqual(header, secret)) return NextResponse.json({ ok: false }, { status: 401 });

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (!update || typeof update.update_id !== "number") return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await handleUpdate(getBotDeps(), update);
  } catch (error) {
    // Acknowledge anyway: retrying won't help, and update_id dedupe makes a retry a no-op.
    console.error("Telegram webhook failed", error);
  }
  return NextResponse.json({ ok: true });
}
