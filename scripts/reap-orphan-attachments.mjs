#!/usr/bin/env node
// scripts/reap-orphan-attachments.mjs
// 刪掉「沒有任何 tasks.description 引用、且建立超過 grace 小時」的附件。
// grace 緩衝涵蓋「上傳了還沒存檔」與「undo 把圖片拉回來」兩種情況。
//
// 用法：
//   node scripts/reap-orphan-attachments.mjs --dry-run          # 只列不刪
//   node scripts/reap-orphan-attachments.mjs                    # 刪（grace 24h）
//   node scripts/reap-orphan-attachments.mjs --grace-hours=72
//   未知參數 / grace < 1 / grace 空值 → 印 usage、exit 2，不碰 DB。
//
// 引用判斷用 position(id in description) > 0（精確子字串），不用 LIKE —
// nanoid 含 `_`，LIKE 會把它當萬用字元。
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const USAGE = `用法：node scripts/reap-orphan-attachments.mjs [--dry-run] [--grace-hours=<n>]
  --dry-run          只列不刪
  --grace-hours=<n>  只處理建立超過 n 小時的附件（預設 24，必須 >= 1）
其他參數一律拒絕（打錯旗標不能變成真刪）。`;

/** 嚴格解析：只認 --dry-run 與 --grace-hours=<n>；其他 → null（呼叫端印 usage + exit 2）。 */
function parseArgs(argv) {
  let dryRun = false;
  let graceHours = 24;
  for (const a of argv) {
    if (a === "--dry-run") {
      dryRun = true;
    } else if (a.startsWith("--grace-hours=")) {
      const raw = a.slice("--grace-hours=".length);
      const n = raw.trim() === "" ? Number.NaN : Number(raw);
      if (!Number.isFinite(n) || n < 1) {
        return { error: `--grace-hours 必須是 >= 1 的數字（收到 "${raw}"）` };
      }
      graceHours = n;
    } else {
      return { error: `未知參數：${a}` };
    }
  }
  return { dryRun, graceHours };
}

const orphanSQL = `
  SELECT a.id, a.user_id, a.size, a.created_at
  FROM task_attachments a
  WHERE a.created_at < $1
    AND NOT EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.user_id = a.user_id
        AND t.description IS NOT NULL
        AND position(a.id in t.description) > 0
    )
  ORDER BY a.created_at
`;

async function main() {
  // 先驗參數，再碰 .env / DB。
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(parsed.error);
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  const { dryRun, graceHours } = parsed;

  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(`找不到 ${envPath}`);
    process.exitCode = 1;
    return;
  }
  const env = Object.fromEntries(
    fs.readFileSync(envPath, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
  );
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL 不在 .env.local");
    process.exitCode = 1;
    return;
  }

  const cutoff = new Date(Date.now() - graceHours * 3600 * 1000).toISOString();
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    const { rows } = await pool.query(orphanSQL, [cutoff]);
    const total = rows.reduce((s, r) => s + Number(r.size), 0);
    console.log(`孤兒附件 ${rows.length} 筆，共 ${(total / 1024 / 1024).toFixed(2)} MB（created_at < ${cutoff}）`);
    for (const r of rows) console.log(`  ${r.id}  ${r.created_at}  ${r.size} bytes`);
    if (dryRun || rows.length === 0) {
      if (dryRun) console.log("(dry-run，未刪除)");
      process.exitCode = 0;
      return;
    }
    const ids = rows.map((r) => r.id);
    const del = await pool.query(`DELETE FROM task_attachments WHERE id = ANY($1::text[])`, [ids]);
    console.log(`已刪除 ${del.rowCount} 筆`);
  } finally {
    await pool.end();
  }
}

await main();
