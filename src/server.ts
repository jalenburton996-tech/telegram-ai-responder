import Fastify from "fastify";
import helmet from "@fastify/helmet";
import { config } from "./config.js";
import { db } from "./db.js";
import { redis, updatesQueue } from "./queue.js";
import type { TelegramUpdate } from "./types.js";
import { telegram } from "./telegram.js";

const app = Fastify({ logger: { level: config.LOG_LEVEL }, bodyLimit: 1_000_000, trustProxy: true });
await app.register(helmet);

app.get("/health/live", async () => ({ ok: true }));
app.get("/health/ready", async (_request, reply) => {
  try {
    await Promise.all([db.query("SELECT 1"), redis.ping()]);
    return { ok: true };
  } catch {
    return reply.code(503).send({ ok: false });
  }
});

app.post<{ Body: TelegramUpdate }>("/webhooks/telegram", async (request, reply) => {
  const secret = request.headers["x-telegram-bot-api-secret-token"];
  if (secret !== config.TELEGRAM_WEBHOOK_SECRET) return reply.code(401).send({ ok: false });
  const update = request.body;
  if (!Number.isSafeInteger(update?.update_id)) return reply.code(400).send({ ok: false });
  await updatesQueue.add("update", update, { jobId: `telegram-${update.update_id}`, attempts: 5, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 1000, removeOnFail: 5000 });
  return { ok: true };
});

const close = async () => { await app.close(); await updatesQueue.close(); await redis.quit(); await db.end(); };
process.on("SIGTERM", close);
process.on("SIGINT", close);
await app.listen({ host: "0.0.0.0", port: config.PORT });

if (config.EMBEDDED_WORKER) await import("./worker.js");
if (config.AUTO_CONFIGURE_WEBHOOK) {
  if (!config.PUBLIC_BASE_URL) throw new Error("A public service address was not provided by the host");
  await telegram("setWebhook", {
    url: `${config.PUBLIC_BASE_URL}/webhooks/telegram`,
    secret_token: config.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["business_connection", "business_message", "edited_business_message", "deleted_business_messages"],
    drop_pending_updates: false
  });
  app.log.info("Telegram webhook configured");
}
