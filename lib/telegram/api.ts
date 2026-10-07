// Minimal Telegram Bot API client (https://core.telegram.org/bots/api).

export type InlineButton = { text: string; callback_data: string } | { text: string; url: string } | { text: string; web_app: { url: string } };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export type TelegramUpdate = {
  update_id: number;
  message?: { message_id: number; chat: { id: number; type: string }; from?: { id: number }; text?: string };
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number; type: string } };
  };
};

export interface TelegramClient {
  sendMessage(chatId: string, text: string, keyboard?: InlineKeyboard): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
  clearKeyboard(chatId: string, messageId: number): Promise<void>;
}

export function createTelegramClient(token: string, fetchImpl: typeof fetch = fetch): TelegramClient {
  async function call(method: string, body: Record<string, unknown>) {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      // Never log the token-bearing URL.
      throw new Error(`Telegram ${method} failed with HTTP ${response.status}`);
    }
  }

  return {
    sendMessage: (chatId, text, keyboard) =>
      call("sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: true }, ...(keyboard ? { reply_markup: keyboard } : {}) }),
    answerCallbackQuery: (callbackQueryId, text) => call("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
    clearKeyboard: (chatId, messageId) =>
      call("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
  };
}

/** Points the bot at Auctra's webhook. Returns Telegram's own description on failure. */
export async function registerWebhook(
  token: string,
  input: { url: string; secret: string },
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; description?: string }> {
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: input.url, secret_token: input.secret, allowed_updates: ["message", "callback_query"] })
  });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  return { ok: response.ok && data.ok === true, description: data.description };
}

export const BOT_PROFILE = {
  description: [
    "Tell Auctra what your money should do, in plain words. It schedules USDC transfers and asks you to confirm before anything runs.",
    "",
    "Try: Save 20 USDC to my savings wallet every Friday at 6 PM",
    "",
    "Monad Testnet, test USDC only. Auctra never asks for a seed phrase."
  ].join("\n"),
  shortDescription: "Automate USDC transfers in plain words. Monad Testnet.",
  commands: [
    { command: "start", description: "Set up or check your account" },
    { command: "balance", description: "Wallet balance" },
    { command: "automations", description: "Your automations" },
    { command: "destinations", description: "Saved destinations" },
    { command: "history", description: "Recent transfers" },
    { command: "help", description: "What Auctra can do" }
  ]
};

/** Sets the bot's description, About text, command menu and "Open" button. */
export async function configureBotProfile(token: string, appUrl: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const calls: [string, Record<string, unknown>][] = [
    ["setMyDescription", { description: BOT_PROFILE.description }],
    ["setMyShortDescription", { short_description: BOT_PROFILE.shortDescription }],
    ["setMyCommands", { commands: BOT_PROFILE.commands }],
    ["setChatMenuButton", { menu_button: { type: "web_app", text: "Open", web_app: { url: `${appUrl}/dashboard` } } }]
  ];
  const failed: string[] = [];
  for (const [method, body] of calls) {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) failed.push(method);
  }
  return failed;
}
