import { describe, expect, it, vi } from "vitest";
import { BOT_PROFILE, configureBotProfile, registerWebhook } from "../lib/telegram/api";

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

describe("configureBotProfile", () => {
  it("sets description, about text, commands and an Open button pointing at the dashboard", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: true })));
    const failed = await configureBotProfile("123:abc", "https://app.test", fetchImpl as unknown as typeof fetch);
    expect(failed).toEqual([]);
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url]) => url.split("/").pop())).toEqual(["setMyDescription", "setMyShortDescription", "setMyCommands", "setChatMenuButton"]);
    expect(JSON.parse(calls[3][1].body as string).menu_button.web_app.url).toBe("https://app.test/dashboard");
  });

  it("keeps Telegram's length limits", () => {
    expect(BOT_PROFILE.description.length).toBeLessThanOrEqual(512);
    expect(BOT_PROFILE.shortDescription.length).toBeLessThanOrEqual(120);
  });
});
