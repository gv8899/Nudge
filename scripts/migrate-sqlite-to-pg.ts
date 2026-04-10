import Database from "better-sqlite3";
import { Pool } from "pg";

const SQLITE_PATH = process.env.SQLITE_PATH || "./nudge.db";
const PG_URL = process.env.DATABASE_URL;

if (!PG_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pool = new Pool({ connectionString: PG_URL });

const TABLES = [
  "users",
  "tasks",
  "tags",
  "task_tags",
  "status_history",
  "daily_task_assignments",
  "daily_notes",
] as const;

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const table of TABLES) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      console.log(`${table}: ${rows.length} rows`);

      if (rows.length === 0) continue;

      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row).map((v) => {
          // SQLite boolean (0/1) → PostgreSQL boolean
          if (table === "daily_task_assignments" && typeof v === "number" && (v === 0 || v === 1)) {
            return v === 1;
          }
          return v;
        });
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
        const columnNames = columns.map((c) => `"${c}"`).join(", ");

        await client.query(
          `INSERT INTO "${table}" (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
      }
    }

    await client.query("COMMIT");
    console.log("Migration complete!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", e);
    throw e;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

migrate();
