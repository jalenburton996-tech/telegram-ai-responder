import { redis } from "./queue.js";
import { config } from "./config.js";

async function incrementWindow(key: string, seconds: number) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, seconds);
  return count;
}

export async function withinLimits(connectionId: string, chatId: number) {
  const [chat, global] = await Promise.all([
    incrementWindow(`rate:chat:${connectionId}:${chatId}:${Math.floor(Date.now() / 3_600_000)}`, 3700),
    incrementWindow(`rate:global:${Math.floor(Date.now() / 60_000)}`, 70)
  ]);
  return chat <= config.MAX_REPLIES_PER_CHAT_PER_HOUR && global <= config.MAX_GLOBAL_REPLIES_PER_MINUTE;
}
