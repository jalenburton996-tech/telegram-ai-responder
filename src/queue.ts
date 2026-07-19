import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.js";
import type { TelegramUpdate } from "./types.js";

export const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
export const updatesQueue = new Queue<TelegramUpdate>("telegram-updates", { connection: redis });
