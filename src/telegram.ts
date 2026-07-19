import { config } from "./config.js";

const base = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;

export async function telegram<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${base}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json() as { ok: boolean; result?: T; description?: string };
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} failed: ${data.description ?? response.status}`);
  return data.result as T;
}

export async function sendBusinessMessage(connectionId: string, chatId: number, text: string) {
  return telegram<{ message_id: number }>("sendMessage", {
    business_connection_id: connectionId, chat_id: chatId, text,
    link_preview_options: { is_disabled: true }
  });
}
