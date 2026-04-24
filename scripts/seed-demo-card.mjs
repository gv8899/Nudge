#!/usr/bin/env node
// One-shot: 建一張「所有樣式展示」的卡片到指定 user。
// 用法：
//   node scripts/seed-demo-card.mjs               # 預設 email
//   node scripts/seed-demo-card.mjs <email>       # 換 user
//
// DATABASE_URL 從 .env.local 讀，不接受從 argv 傳（避免 credentials
// 流到 shell history / transcript）。

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { nanoid } from "nanoid";

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
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL 不在 .env.local 也不在環境變數");
  process.exit(1);
}

const email = process.argv[2] || "gv88999@gmail.com";

const html = `<h1>標題一 H1</h1>
<p>這是一段 <strong>粗體</strong>、<em>斜體</em>、<strong><em>粗斜體</em></strong>、以及 <code>inline code</code> 的段落。</p>
<h2>標題二 H2</h2>
<p>可以一般段落夾一些 <s>刪除線</s> 或 <code>editor.commands.focus()</code> 這種行內程式碼。</p>
<h3>標題三 H3</h3>
<p>再下來是清單、引言、程式碼區塊、分隔線。</p>
<hr>
<h2>Bullet List</h2>
<ul>
<li>第一個項目符號</li>
<li>第二個，含 <strong>粗體</strong></li>
<li>第三個，含 <code>code</code></li>
</ul>
<h2>Ordered List</h2>
<ol>
<li>有序清單第一項</li>
<li>第二項</li>
<li>第三項，可以嵌 <em>斜體</em></li>
</ol>
<h2>Task List</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><div><p>已完成的待辦（打勾）</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>未完成的待辦</p></div></li>
<li data-type="taskItem" data-checked="false"><div><p>帶 <strong>粗體</strong> 的未完成待辦</p></div></li>
</ul>
<h2>Blockquote</h2>
<blockquote><p>這是引言區塊 — 可以放名言、重點摘要之類。</p></blockquote>
<h2>Code Block</h2>
<pre><code class="language-typescript">function hello(name: string) {
  console.log(\`Hello, \${name}!\`);
}

hello("Nudge");</code></pre>
<h2>行內組合</h2>
<p>段落裡混雜 <strong>粗</strong>、<em>斜</em>、<code>code</code>、<s>刪除</s>、一般文字，以及中文全形「標點符號」測試。</p>
<hr>
<h2>長段落 wrap 測試</h2>
<p>這是一段比較長的文字，用來測試在 iOS / macOS WKWebView 裡 line-wrap 的行為，以及 dark mode 下文字顏色是否吃 theme token。Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
<h2>多層 Bullet</h2>
<ul>
<li>第一層 A
<ul>
<li>第二層 A-1</li>
<li>第二層 A-2</li>
</ul>
</li>
<li>第一層 B</li>
</ul>`;

const title = "【樣式展示】editor 所有可用格式";

const pool = new Pool({ connectionString: DATABASE_URL });
const client = await pool.connect();
try {
  const userQ = await client.query(
    "SELECT id, email FROM users WHERE email = $1 LIMIT 1",
    [email],
  );
  if (userQ.rows.length === 0) {
    console.error(`找不到 user email=${email}`);
    process.exit(1);
  }
  const userId = userQ.rows[0].id;
  console.log(`→ user ${email} (id=${userId})`);

  const id = nanoid();
  const now = new Date().toISOString();

  await client.query("BEGIN");
  await client.query(
    `INSERT INTO tasks (id, user_id, title, description, status, created_at, updated_at, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, userId, title, html, "inbox", now, now, 0],
  );
  await client.query(
    `INSERT INTO status_history (id, task_id, from_status, to_status, changed_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [nanoid(), id, null, "inbox", now],
  );
  await client.query("COMMIT");

  console.log(`✓ 建立卡片 id=${id}`);
  console.log(`  title: ${title}`);
  console.log(`  status: inbox`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("✗ 失敗:", err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
