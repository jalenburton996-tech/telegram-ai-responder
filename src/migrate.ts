import { db } from "./db.js";

const sql = `
CREATE TABLE IF NOT EXISTS business_connections (
  id text PRIMARY KEY, business_user_id bigint NOT NULL, enabled boolean NOT NULL,
  can_reply boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chats (
  connection_id text NOT NULL, chat_id bigint NOT NULL, peer_user_id bigint,
  takeover_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, chat_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id bigserial PRIMARY KEY, connection_id text NOT NULL, chat_id bigint NOT NULL,
  telegram_message_id bigint NOT NULL, direction text NOT NULL CHECK (direction IN ('in','ai','human')),
  body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, chat_id, telegram_message_id)
);
CREATE INDEX IF NOT EXISTS messages_memory_idx ON messages(connection_id, chat_id, created_at DESC);
CREATE TABLE IF NOT EXISTS processed_updates (
  update_id bigint PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY, event text NOT NULL, connection_id text, chat_id bigint,
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
`;

await db.query(sql);
await db.end();
console.log("Database migrations complete");
