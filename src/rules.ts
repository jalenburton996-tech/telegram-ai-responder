import { DateTime } from "luxon";
import { config, parseIds } from "./config.js";

const allow = parseIds(config.ALLOW_USER_IDS);
const deny = parseIds(config.DENY_USER_IDS);

export function isUserAllowed(userId: number): boolean {
  const id = String(userId);
  return !deny.has(id) && (allow.size === 0 || allow.has(id));
}

export function isOpen(now: DateTime<boolean> = DateTime.now()): boolean {
  const local = now.setZone(config.TIMEZONE);
  if (!local.isValid) return false;
  const rule = config.BUSINESS_HOURS.split(",")[local.weekday - 1]?.trim();
  if (!rule || rule === "closed") return false;
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(rule);
  if (!match) return false;
  const [, sh, sm, eh, em] = match.map(Number);
  const minute = local.hour * 60 + local.minute;
  return minute >= sh! * 60 + sm! && minute < eh! * 60 + em!;
}
