export type TelegramUser = { id: number; is_bot?: boolean; first_name?: string; username?: string };
export type TelegramChat = { id: number; type: string };
export type TelegramMessage = {
  message_id: number; date: number; text?: string; caption?: string;
  from?: TelegramUser; sender_business_bot?: TelegramUser; chat: TelegramChat;
  business_connection_id?: string;
};
export type BusinessConnection = {
  id: string; user: TelegramUser; user_chat_id: number; date: number; is_enabled: boolean;
  rights?: { can_reply?: boolean; can_read_messages?: boolean };
};
export type TelegramUpdate = {
  update_id: number; business_connection?: BusinessConnection;
  business_message?: TelegramMessage; edited_business_message?: TelegramMessage;
  deleted_business_messages?: { business_connection_id: string; chat: TelegramChat; message_ids: number[] };
};
