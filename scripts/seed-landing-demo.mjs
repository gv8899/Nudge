#!/usr/bin/env node
// 為 landing page 截圖灌一整套乾淨的 demo 資料（今日任務 / 逾期 / 卡片 /
// 日誌 / 標籤 / 重複任務 / 提醒），內容對齊行銷文案的故事線。
//
// 前置：先用該 Google 帳號登入 app 一次（建立 user row），再跑這支。
//
// 用法：
//   node scripts/seed-landing-demo.mjs <email>            # 加灌（不刪舊資料）
//   node scripts/seed-landing-demo.mjs <email> --reset    # 先清空該帳號再灌
//
// DATABASE_URL 從 .env.local 讀，不從 argv 傳（避免 credentials 流到 history）。
// ⚠️ --reset 會刪光該 email 帳號的所有 tasks / notes / tags，務必確認是 demo 帳號。

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { nanoid } from "nanoid";

// ── 讀 .env.local ──
const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error(`找不到 ${envPath}`);
  process.exit(1);
}
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [
        l.slice(0, idx).trim(),
        l
          .slice(idx + 1)
          .trim()
          .replace(/^"|"$/g, ""),
      ];
    }),
);
const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL 不在 .env.local 也不在環境變數");
  process.exit(1);
}

const argv = process.argv.slice(2).filter((a) => a !== "--reset");
const RESET = process.argv.includes("--reset");
const email = argv[0];
if (!email) {
  console.error("用法：node scripts/seed-landing-demo.mjs <email> [--reset]");
  process.exit(1);
}

// ── 日期工具（本機時區，對齊 app 看到的「今天」）──
function ymd(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const TODAY = ymd(0);
const nowISO = () => new Date().toISOString();

// ── 標籤 ──
const TAGS = [
  { name: "工作", color: "chart-1" },
  { name: "讀書", color: "chart-2" },
  { name: "運動", color: "chart-3" },
  { name: "生活", color: "chart-4" },
];

// ── 純任務（無內容）：今日 + 逾期 ──
// assignDate: 指派到哪天；done: 是否已完成
const PLAIN_TASKS = [
  { title: "早晨運動", assignDate: ymd(0), done: true },
  { title: "寫週報", assignDate: ymd(0), recur: "weekly_fri", remind: "17:00" },
  { title: "準備簡報", assignDate: ymd(0) },
  { title: "閱讀 1 章", assignDate: ymd(0) },
  { title: "晨間站會", assignDate: ymd(0), recur: "weekdays" },
  // 逾期（前幾天的）
  { title: "繳水電費", assignDate: ymd(-5) },
  { title: "回覆客戶 Email", assignDate: ymd(-3) },
];

// ── 卡片（有 HTML 內容的任務）──
const CARDS = [
  {
    title: "Q2 團隊 OKR 討論",
    tag: "工作",
    createdOffset: -1,
    html: `<h2>下季方向</h2>
<p>今天會議意外談出了下季的方向。重點不是開多少會，是有沒有留下<strong>可以行動的結論</strong>。</p>
<h3>三個 Key Result</h3>
<ul>
<li>新用戶啟用率從 32% 提升到 45%</li>
<li>核心流程的 P50 延遲降到 200ms 以下</li>
<li>每週固定出一篇產品紀錄</li>
</ul>
<blockquote><p>與其追蹤一堆指標，不如把一個指標做到位。</p></blockquote>`,
  },
  {
    title: "跑步筆記：第一個月的感想",
    tag: "運動",
    createdOffset: -3,
    html: `<p>剛起步時膝蓋會痠，配速也抓不準。三週後身體逐漸適應，從 5K 變成可以跑 8K 不喘。</p>
<h3>學到的事</h3>
<ul>
<li>慢慢加量，比一次衝太快更能持續</li>
<li>跑前動態伸展，膝蓋負擔小很多</li>
<li>固定時間跑，最容易養成習慣</li>
</ul>`,
  },
  {
    title: "產品設計：減法的力量",
    tag: "讀書",
    createdOffset: -4,
    html: `<p>讀完《<em>Subtract</em>》第 2 章，幾個重點：</p>
<blockquote><p>人類天生傾向「加東西」來解決問題，但研究顯示主動「減東西」往往效果更好。</p></blockquote>
<h3>對 Nudge 的啟發</h3>
<ul>
<li>不要為了「完整性」加功能</li>
<li><strong>YAGNI</strong> 不只是工程原則，也是產品原則</li>
<li>每個功能都要問：刪掉會怎樣？</li>
</ul>
<h3>程式碼小技巧</h3>
<p>用 <code>color-mix()</code> 可以用一個變數產生半透明版本，省下一組 token。</p>`,
  },
  {
    title: "週末京都小旅行計畫",
    tag: "生活",
    createdOffset: -7,
    html: `<p>四天三夜。想去的地方：</p>
<ul>
<li>嵐山竹林</li>
<li>伏見稻荷</li>
<li>鴨川散步</li>
</ul>
<p>住宿想試試<strong>町家風格</strong>。交通用 ICOCA 比較方便。</p>`,
  },
];

// ── 日誌（daily_notes）──
const NOTES = [
  {
    dateOffset: 0,
    lines: [
      "早上去跑了 5 公里。久沒動了，膝蓋提醒我要重新適應。",
      "晚上吃得清淡一點，意外地比想像中舒服。",
    ],
  },
  {
    dateOffset: -1,
    lines: [
      "會議很多，但意外談出了下季的方向。",
      "重點不是開多少會，是有沒有留下可以行動的結論。",
    ],
  },
  {
    dateOffset: -2,
    lines: [
      "讀了一篇關於「慢下來反而走得更遠」的文章。",
      "很多時候我以為是生產力問題，其實是注意力問題。",
    ],
  },
];

const pool = new Pool({ connectionString: DATABASE_URL });
const client = await pool.connect();
try {
  // user 必須已存在（先用該帳號登入過 app）
  const userQ = await client.query(
    "SELECT id, email FROM users WHERE email = $1 LIMIT 1",
    [email],
  );
  if (userQ.rows.length === 0) {
    console.error(
      `找不到 user email=${email}\n→ 請先用這個 Google 帳號登入一次 app（建立帳號），再跑這支腳本。`,
    );
    process.exit(1);
  }
  const userId = userQ.rows[0].id;
  console.log(`→ user ${email} (id=${userId})  今天=${TODAY}`);

  await client.query("BEGIN");

  if (RESET) {
    // FK-safe 順序：先子表再主表
    await client.query(
      `DELETE FROM daily_task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE user_id=$1)`,
      [userId],
    );
    await client.query(
      `DELETE FROM status_history WHERE task_id IN (SELECT id FROM tasks WHERE user_id=$1)`,
      [userId],
    );
    await client.query(
      `DELETE FROM task_recurrences WHERE task_id IN (SELECT id FROM tasks WHERE user_id=$1)`,
      [userId],
    );
    await client.query(
      `DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE user_id=$1)`,
      [userId],
    );
    await client.query(`DELETE FROM tasks WHERE user_id=$1`, [userId]);
    await client.query(`DELETE FROM tags WHERE user_id=$1`, [userId]);
    await client.query(`DELETE FROM daily_notes WHERE user_id=$1`, [userId]);
    console.log("  ⟲ 已清空該帳號舊資料 (--reset)");
  }

  // 標籤
  const tagId = {};
  let tagOrder = 0;
  for (const t of TAGS) {
    const id = nanoid();
    tagId[t.name] = id;
    await client.query(
      `INSERT INTO tags (id, user_id, name, color, sort_order) VALUES ($1,$2,$3,$4,$5)`,
      [id, userId, t.name, t.color, tagOrder++],
    );
  }
  console.log(`  ✓ ${TAGS.length} 個標籤`);

  // 內部：建一個 task（可選 description / status / remind）+ status_history
  let sortCounter = 0;
  async function insertTask({
    title,
    description = null,
    status = "inbox",
    createdAt = nowISO(),
    remindAt = null,
  }) {
    const id = nanoid();
    await client.query(
      `INSERT INTO tasks (id, user_id, title, description, status, created_at, updated_at, completed_at, remind_at, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        userId,
        title,
        description,
        status,
        createdAt,
        createdAt,
        status === "done" ? createdAt : null,
        remindAt,
        sortCounter++,
      ],
    );
    await client.query(
      `INSERT INTO status_history (id, task_id, from_status, to_status, changed_at) VALUES ($1,$2,$3,$4,$5)`,
      [nanoid(), id, null, status, createdAt],
    );
    return id;
  }

  async function assignToDay(taskId, date, isCompleted = false, order = 0) {
    await client.query(
      `INSERT INTO daily_task_assignments (id, task_id, date, is_completed, is_skipped, sort_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (task_id, date) DO NOTHING`,
      [nanoid(), taskId, date, isCompleted, false, order, nowISO()],
    );
  }

  async function addRecurrence(taskId, kind) {
    const base = {
      id: nanoid(),
      taskId,
      startDate: TODAY,
      createdAt: nowISO(),
    };
    if (kind === "weekly_fri") {
      await client.query(
        `INSERT INTO task_recurrences (id, task_id, preset, weekdays, start_date, remind_at_time_of_day, created_at, updated_at)
         VALUES ($1,$2,'weekly','5',$3,'17:00',$4,$4)`,
        [base.id, taskId, base.startDate, base.createdAt],
      );
    } else if (kind === "weekdays") {
      await client.query(
        `INSERT INTO task_recurrences (id, task_id, preset, weekdays, start_date, created_at, updated_at)
         VALUES ($1,$2,'weekdays','1,2,3,4,5',$3,$4,$4)`,
        [base.id, taskId, base.startDate, base.createdAt],
      );
    }
  }

  // 純任務（今日 + 逾期）
  let dayOrder = 0;
  for (const t of PLAIN_TASKS) {
    const status = t.done ? "done" : "inbox";
    const id = await insertTask({
      title: t.title,
      status,
      remindAt: t.remind ? `${t.assignDate}T${t.remind}:00` : null,
    });
    await assignToDay(id, t.assignDate, !!t.done, dayOrder++);
    if (t.recur) await addRecurrence(id, t.recur);
  }
  console.log(`  ✓ ${PLAIN_TASKS.length} 個任務（今日/逾期，含重複/提醒）`);

  // 卡片（有內容的任務）+ 標籤
  for (const c of CARDS) {
    const created = (() => {
      const d = new Date();
      d.setDate(d.getDate() + c.createdOffset);
      return d.toISOString();
    })();
    const id = await insertTask({
      title: c.title,
      description: c.html,
      status: "inbox",
      createdAt: created,
    });
    if (c.tag && tagId[c.tag]) {
      await client.query(
        `INSERT INTO task_tags (task_id, tag_id) VALUES ($1,$2)`,
        [id, tagId[c.tag]],
      );
    }
  }
  console.log(`  ✓ ${CARDS.length} 張卡片（HTML 內容 + 標籤）`);

  // 日誌
  let noteOrder = 0;
  for (const n of NOTES) {
    await client.query(
      `INSERT INTO daily_notes (id, user_id, date, content, created_at, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
      [nanoid(), userId, ymd(n.dateOffset), n.lines.join("\n\n"), nowISO(), noteOrder++],
    );
  }
  console.log(`  ✓ ${NOTES.length} 則日誌`);

  // 通知偏好（每 user 一筆，存在就更新）
  await client.query(
    `INSERT INTO notification_preferences (user_id, per_task_reminders_enabled, updated_at)
     VALUES ($1, true, $2)
     ON CONFLICT (user_id) DO UPDATE SET per_task_reminders_enabled = true, updated_at = $2`,
    [userId, nowISO()],
  );

  await client.query("COMMIT");
  console.log("✓ demo 資料灌入完成。用該帳號開 app（淺色主題）即可截圖。");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("✗ 失敗:", err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
