import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import path from "path";

const dbPath = process.env.DB_PATH || path.join(process.cwd(), "nudge.db");

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite, { schema });

    // 自動跑 migration，確保表存在
    try {
      migrate(_db, {
        migrationsFolder: path.join(process.cwd(), "drizzle"),
      });
    } catch (e) {
      // migration 已經跑過就會拋錯，忽略
    }
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});
