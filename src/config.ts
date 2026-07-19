import "dotenv/config";
import { createHash } from "node:crypto";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(10),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(32),
  PUBLIC_BASE_URL: z.string().url().transform((v) => v.replace(/\/$/, "")).optional(),
  RENDER_EXTERNAL_HOSTNAME: z.string().optional(),
  AUTO_CONFIGURE_WEBHOOK: z.string().default("false").transform((v) => v === "true"),
  EMBEDDED_WORKER: z.string().default("false").transform((v) => v === "true"),
  OPENAI_API_KEY: z.string().min(10),
  OPENAI_MODEL: z.string().default("gpt-5.4-mini"),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(50).max(4000).default(500),
  BUSINESS_NAME: z.string().min(1),
  BUSINESS_CONTEXT: z.string().min(1),
  ASSISTANT_TONE: z.string().default("Friendly, concise, accurate, and transparent that you are an AI assistant."),
  ESCALATION_MESSAGE: z.string().default("I’m handing this to a person who can help. They’ll reply soon."),
  TIMEZONE: z.string().default("UTC"),
  BUSINESS_HOURS: z.string().default("09:00-17:00,09:00-17:00,09:00-17:00,09:00-17:00,09:00-17:00,closed,closed"),
  OUT_OF_HOURS_MODE: z.enum(["hold", "message", "reply"]).default("hold"),
  OUT_OF_HOURS_MESSAGE: z.string().default("Thanks for your message. We’re currently closed and will reply during business hours."),
  ALLOW_USER_IDS: z.string().default(""),
  DENY_USER_IDS: z.string().default(""),
  MAX_REPLIES_PER_CHAT_PER_HOUR: z.coerce.number().int().positive().default(12),
  MAX_GLOBAL_REPLIES_PER_MINUTE: z.coerce.number().int().positive().default(30),
  MANUAL_TAKEOVER_MINUTES: z.coerce.number().int().positive().default(120),
  MEMORY_MESSAGES: z.coerce.number().int().min(0).max(50).default(12),
  MEMORY_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  REPLY_DELAY_MS: z.coerce.number().int().min(0).max(30000).default(1500)
});

const parsed = schema.parse(process.env);
export const config = {
  ...parsed,
  TELEGRAM_WEBHOOK_SECRET: createHash("sha256").update(parsed.TELEGRAM_WEBHOOK_SECRET).digest("hex"),
  PUBLIC_BASE_URL: parsed.PUBLIC_BASE_URL ?? (parsed.RENDER_EXTERNAL_HOSTNAME ? `https://${parsed.RENDER_EXTERNAL_HOSTNAME}` : undefined)
};
export const parseIds = (value: string) => new Set(value.split(",").map((x) => x.trim()).filter(Boolean));
