import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.js";
import { db } from "./db.js";
import { processUpdate, purgeExpiredData } from "./processor.js";
import type { TelegramUpdate } from "./types.js";

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const worker = new Worker<TelegramUpdate>("telegram-updates", (job) => processUpdate(job.data), { connection, concurrency: 4, limiter: { max: 20, duration: 1000 } });
worker.on("failed", (job, error) => console.error(JSON.stringify({ level: "error", event: "job_failed", jobId: job?.id, error: error.message })));
const purgeTimer = setInterval(() => purgeExpiredData().catch((error) => console.error(error)), 6 * 60 * 60 * 1000);
purgeTimer.unref();

const close = async () => { clearInterval(purgeTimer); await worker.close(); await connection.quit(); await db.end(); };
process.on("SIGTERM", close);
process.on("SIGINT", close);
console.log(JSON.stringify({ level: "info", event: "worker_ready" }));
