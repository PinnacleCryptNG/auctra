import { describe, expect, it, vi } from "vitest";
import { registerWebhook } from "../lib/telegram/api";

describe("registerWebhook", () => {
  it("sends the webhook URL and secret to setWebhook", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: true })));
    const result = await registerWebhook("123:abc", { url: "https://app.test/api/telegram/webhook", secret: "s3cret" }, fetchImpl as unknown as typeof fetch);
    expect(result).toEqual({ ok: true, description: undefined });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bot123:abc/setWebhook");
    expect(JSON.parse(init.body as string)).toMatchObject({ url: "https://app.test/api/telegram/webhook", secret_token: "s3cret" });
  });

  it("passes Telegram's description back on failure", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: false, description: "Unauthorized" }), { status: 401 }));
    expect(await registerWebhook("bad", { url: "https://x", secret: "s" }, fetchImpl as unknown as typeof fetch)).toEqual({ ok: false, description: "Unauthorized" });
  });
});
