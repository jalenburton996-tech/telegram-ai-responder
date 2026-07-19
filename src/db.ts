import pg from "pg";
import { config } from "./config.js";

export const db = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10, ssl: config.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });

export async function query<T extends pg.QueryResultRow>(text: string, values: unknown[] = []) {
  return db.query<T>(text, values);
}
