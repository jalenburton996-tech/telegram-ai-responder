import { config } from "./config.js";
import { query } from "./db.js";
import { generateReply } from "./ai.js";
import { isOpen, isUserAllowed } from "./rules.js";
import { withinLimits } from "./rate-limit.js";
import { getBusinessConnection, sendBusinessMessage } from "./telegram.js";
import type { BusinessConnection, TelegramMessage, TelegramUpdate } from "./types.js";

const audit = async (event: string, connectionId?: string, chatId?: number, metadata: Record<string, unknown> = {}) => {
  console.log(JSON.stringify({ level: "info", event, connectionId, chatId, ...metadata }));
  await query("INSERT INTO audit_log(event, connection_id, chat_id, metadata) VALUES($1,$2,$3,$4)", [event, connectionId, chatId, JSON.stringify(metadata)]);
};

async function connection(update: BusinessConnection) {
  await query(`INSERT INTO business_connections(id,business_user_id,enabled,can_reply,updated_at)
    VALUES($1,$2,$3,$4,now()) ON CONFLICT(id) DO UPDATE SET business_user_id=$2,enabled=$3,can_reply=$4,updated_at=now()`,
    [update.id, update.user.id, update.is_enabled, update.rights?.can_reply === true]);
  await audit("business_connection", update.id, undefined, { enabled: update.is_enabled, canReply: update.rights?.can_reply === true });
}

async function saveMessage(connectionId: string, chatId: number, messageId: number, direction: "in" | "ai" | "human", body: string) {
  await query(`INSERT INTO messages(connection_id,chat_id,telegram_message_id,direction,body)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [connectionId, chatId, messageId, direction, body]);
}

async function processMessage(message: TelegramMessage) {
  const connectionId = message.business_connection_id;
  const senderId = message.from?.id;
  const body = message.text ?? message.caption;
  if (!connectionId || !senderId || !body) return;
  let { rows } = await query<{ business_user_id: string; enabled: boolean; can_reply: boolean }>(
    "SELECT business_user_id,enabled,can_reply FROM business_connections WHERE id=$1", [connectionId]);
  let conn = rows[0];
  if (!conn) {
    try {
      await connection(await getBusinessConnection(connectionId));
      ({ rows } = await query<{ business_user_id: string; enabled: boolean; can_reply: boolean }>(
        "SELECT business_user_id,enabled,can_reply FROM business_connections WHERE id=$1", [connectionId]));
      conn = rows[0];
    } catch (error) {
      await audit("connection_recovery_failed", connectionId, message.chat.id, {
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
  if (!conn) return void await audit("connection_not_ready", connectionId, message.chat.id);

  const isOutgoing = String(senderId) === conn.business_user_id;
  if (isOutgoing) {
    const command = body.trim().toLowerCase();
    if (command === "/ai") {
      await query(`INSERT INTO chats(connection_id,chat_id,takeover_until,updated_at) VALUES($1,$2,now(),now())
        ON CONFLICT(connection_id,chat_id) DO UPDATE SET takeover_until=now(),updated_at=now()`, [connectionId, message.chat.id]);
      return void await audit("manual_takeover_ended", connectionId, message.chat.id);
    }
    if (command === "/pause") {
      await query(`INSERT INTO chats(connection_id,chat_id,takeover_until,updated_at) VALUES($1,$2,now()+($3 || ' minutes')::interval,now())
        ON CONFLICT(connection_id,chat_id) DO UPDATE SET takeover_until=excluded.takeover_until,updated_at=now()`, [connectionId, message.chat.id, config.MANUAL_TAKEOVER_MINUTES]);
      return void await audit("manual_takeover", connectionId, message.chat.id);
    }
    const ours = await query("SELECT 1 FROM messages WHERE connection_id=$1 AND chat_id=$2 AND telegram_message_id=$3 AND direction='ai'", [connectionId, message.chat.id, message.message_id]);
    if (ours.rowCount) return;
    await saveMessage(connectionId, message.chat.id, message.message_id, "human", body);
    return void await audit("human_message", connectionId, message.chat.id);
  }
  if (!isUserAllowed(senderId)) return void await audit("blocked_by_access_rule", connectionId, message.chat.id, { senderId });
  await query(`INSERT INTO chats(connection_id,chat_id,peer_user_id,updated_at) VALUES($1,$2,$3,now())
    ON CONFLICT(connection_id,chat_id) DO UPDATE SET peer_user_id=$3,updated_at=now()`, [connectionId, message.chat.id, senderId]);
  await saveMessage(connectionId, message.chat.id, message.message_id, "in", body);
  const takeover = await query("SELECT 1 FROM chats WHERE connection_id=$1 AND chat_id=$2 AND takeover_until>now()", [connectionId, message.chat.id]);
  if (takeover.rowCount) return void await audit("skipped_manual_takeover", connectionId, message.chat.id);

  if (!isOpen() && config.OUT_OF_HOURS_MODE !== "reply") {
    if (config.OUT_OF_HOURS_MODE === "message") await sendAndRecord(connectionId, message.chat.id, config.OUT_OF_HOURS_MESSAGE);
    return void await audit("outside_business_hours", connectionId, message.chat.id);
  }
  if (!await withinLimits(connectionId, message.chat.id)) return void await audit("rate_limited", connectionId, message.chat.id);
  if (config.REPLY_DELAY_MS) await new Promise((resolve) => setTimeout(resolve, config.REPLY_DELAY_MS));
  const memory = await query<{ direction: "in" | "ai" | "human"; body: string }>(
    "SELECT direction,body FROM messages WHERE connection_id=$1 AND chat_id=$2 ORDER BY created_at DESC LIMIT $3", [connectionId, message.chat.id, config.MEMORY_MESSAGES]);
  const result = await generateReply(body, memory.rows.reverse());
  await sendAndRecord(connectionId, message.chat.id, result.text);
  if (result.handoff) {
    await audit("ai_handoff", connectionId, message.chat.id);
  }
}

async function sendAndRecord(connectionId: string, chatId: number, text: string) {
  const sent = await sendBusinessMessage(connectionId, chatId, text);
  await saveMessage(connectionId, chatId, sent.message_id, "ai", text);
}

export async function processUpdate(update: TelegramUpdate) {
  const fresh = await query("INSERT INTO processed_updates(update_id) VALUES($1) ON CONFLICT DO NOTHING", [update.update_id]);
  if (!fresh.rowCount) return;
  if (update.business_connection) return connection(update.business_connection);
  if (update.business_message) return processMessage(update.business_message);
  if (update.deleted_business_messages) return audit("messages_deleted", update.deleted_business_messages.business_connection_id, update.deleted_business_messages.chat.id, { messageIds: update.deleted_business_messages.message_ids });
}

export async function purgeExpiredData() {
  await query("DELETE FROM messages WHERE created_at < now()-($1 || ' days')::interval", [config.MEMORY_RETENTION_DAYS]);
  await query("DELETE FROM processed_updates WHERE created_at < now()-interval '7 days'");
}
