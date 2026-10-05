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
