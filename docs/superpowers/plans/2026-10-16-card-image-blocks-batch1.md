# 卡片圖片區塊 — 批次 1 + 3（後端 + Web 三入口 + Apple 顯示 + 清理）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 卡片內文可以放圖片：Web 三個入口（拖檔、貼上、`/` 圖片）上傳到 Postgres 附件表；圖片是頂層區塊、沿用既有拖曳把手；Mac / iOS 的 TipTap bundle 認得圖片並透過原生攔截器顯示（**不**上傳）。

**Architecture:** 新表 `task_attachments`（bytea）+ 三支 `/api/attachments` 路由；內文只存 `<img src="/api/attachments/<id>" data-attachment-id=…>`。一個**純 ProseMirror** 的 `AttachmentImage` node（`src/components/editor/attachment-image.ts`）由 Web 與 Apple bundle 共用（Apple 透過既有 `@web-editor` alias）；Web 另掛 React node view 做「上傳中」狀態。Apple 端在 `load()` / `getHTML()` 之間把 `src` 雙向改寫成 `nudge-attachment://attachment/<id>`，由 `WKURLSchemeHandler` 帶 Bearer 代抓。

**Tech Stack:** Next.js 16 App Router、drizzle-orm（customType bytea）、TipTap v3.22（`@tiptap/extension-image@3.22.3`、`@tiptap/html@3.22.3` 測試用）、vitest、Swift 6 / WebKit（`WKURLSchemeHandler`）、Swift Testing。

**Spec:** `docs/superpowers/specs/2026-10-16-card-image-blocks-design.md`

## Global Constraints

- `@tiptap/*` 版本 Web 與 `apple/NudgeEditor/package.json` **必須完全相同**（Web 用 `^3.22.x`，Apple 釘死；新加的 `@tiptap/extension-image` 兩邊都用 `3.22.3`）。
- Apple bundle (`apple/NudgeEditor/src/*`) **不得 import React / lucide / next-intl**；只能透過 `@web-editor` alias 取純 ProseMirror 模組。
- 內文 HTML 三邊 byte-identical：Apple 端 `getHTML()` 與 `change` 訊息送出前一定改回 `/api/attachments/<id>`。
- 允許的圖片 mime 只有 `image/jpeg` `image/png` `image/webp` `image/gif`；SVG 一律拒收。
- 伺服器硬上限：單張附件 **5MB**（`MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024`）；`description` **1MB**（`MAX_DESCRIPTION_BYTES = 1024 * 1024`）。
- 客戶端縮圖：最長邊 ≤ **2048**；WebP 品質 **0.85**，不支援則 JPEG；GIF 不縮。
- 所有 UI 字串：先加 `i18n/canonical/zh-TW.json` → `npm run i18n:sync` → 補 en/ja → 再 sync；Apple 用到的 key 再手動鏡像到 `Localizable.xcstrings`。**不要手改 `src/messages/*.json`。**
- Web 顏色只用 design token（`bg-destructive/10`、`text-text-dim`、`ring-primary` 等），禁止 Tailwind 預設色。Swift 只用 `Color.nudgeXxx`。
- ID 用 `nanoid()`（text），與全 repo 一致（spec §1.1 寫 uuid，此處以 nanoid 取代，語意相同）。
- 不加 feature flag（spec §5，使用者決定）。
- Definition of Done 依 `AGENTS.md`：Web 互動流程要在瀏覽器實走；Apple 要 `xcodebuild -scheme Nudge-iOS … build` + 模擬器實測。

## Review Focus

1. **autosave 在上傳途中觸發**：上傳中的節點被 `getHTML()` 序列化。期望：序列化成 `<img data-upload-pending="true">`（無 src），重新載入時被 `parseHTML` 丟掉，不會存出 `blob:` 網址。→ Task 8 測試 `renders pending upload without src`。
2. **貼上含外站圖片的 HTML**（例如從網頁複製一段）：期望圖片節點被丟掉、文字保留，不會存出 `https://…` 的 `<img>`。→ Task 8 測試 `drops external img on parse`。
3. **同一秒內連丟多張圖**：期望每張各自一個區塊、順序 = 檔案順序、任一張失敗只移除自己那格。→ Task 11 手動步驟 + `nextPos` 累加邏輯。
4. **拖「檔案」與拖「區塊把手」撞在一起**：兩者都是 HTML5 DnD。期望 `handleDrop` 只在 `dataTransfer.types` 含 `Files` 時接手；把手拖曳仍由 `useBlockDrag` 處理。→ Task 11 `isFileDrag` 測試 + Task 12 手動矩陣。
5. **他人附件 id / 不存在的 id**：期望 `GET /api/attachments/[id]` 回 404（不是 403、不是 500），且 Apple 攔截器收到失敗後呼叫 `didFailWithError`，不會讓 WebContent 卡住。→ Task 5 curl 步驟、Task 14 `stop` 防呆。

---

## 檔案結構

**新增**
- `drizzle/0011_task_attachments.sql` — migration
- `src/lib/attachments/constants.ts` — 上限常數 + 允許的 mime
- `src/lib/attachments/image-sniff.ts` (+ `.test.ts`) — magic bytes → mime
- `src/components/editor/attachment-url.ts` (+ `.test.ts`) — `/api/attachments/<id>` ↔ `nudge-attachment://attachment/<id>` 雙向改寫、`isAllowedImageSrc`。純字串、Web 與 Apple 共用；放在 `src/components/editor/` 是因為 Apple bundle 只能經 `@web-editor` alias 取這個目錄
- `src/components/editor/attachment-image.ts` (+ `.test.ts`) — 純 ProseMirror Image node + 三個 command
- `src/components/editor/attachment-image-node-view.tsx` — React node view（上傳中 / 選取外框）
- `src/components/editor/use-image-upload.ts` — 驗證 → 插 placeholder → 縮圖 → 上傳 → finalize / fail
- `src/components/editor/file-drag.ts` (+ `.test.ts`) — `isFileDrag(types)`、`pickImageFiles(fileList)`
- `src/lib/image-upload.ts` (+ `.test.ts`) — `isSupportedImageFile`、`computeResizeTarget`、`prepareImageForUpload`、`uploadAttachment`
- `src/app/api/attachments/route.ts` — POST
- `src/app/api/attachments/[id]/route.ts` — GET / DELETE
- `scripts/reap-orphan-attachments.mjs` — 孤兒清理（SQL）
- `apple/NudgeKit/Sources/NudgeCore/AttachmentRepository.swift`
- `apple/NudgeKit/Sources/NudgeUI/Components/AttachmentSchemeHandler.swift`
- `apple/NudgeKit/Tests/NudgeCoreTests/AttachmentRepositoryTests.swift`

**修改**
- `src/lib/db/schema.ts` — `taskAttachments`
- `src/lib/strip-html.ts` (+ 新 `strip-html.test.ts`) — `hasVisibleContent`
- `src/app/api/cards/route.ts` — 純圖卡片不被過濾
- `src/app/api/tasks/[id]/route.ts` — description 1MB 上限
- `src/components/cards/card-detail.tsx`、`src/components/task/task-detail-modal.tsx` — 傳 `attachmentTaskId`、isEmpty 改用 `hasVisibleContent`
- `src/components/editor/editor-extensions.ts` — 掛 Image node + node view
- `src/components/editor/slash-command-defs.ts`、`slash-command-items.tsx` — `image` 項
- `src/components/task/tiptap-editor.tsx` — 三入口 + 錯誤橫幅
- `src/app/globals.css` — `.tiptap img` 樣式
- `i18n/canonical/{zh-TW,en,ja}.json`、`apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`
- `apple/NudgeEditor/package.json`、`src/main.ts`、`src/theme.css`
- `apple/NudgeKit/Sources/NudgeCore/APIClient.swift` — `getData`
- `apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift` — 註冊 scheme handler
- `apple/Nudge-iOS/NudgeiOSApp.swift`、`apple/Nudge-macOS/NudgeMacApp.swift` — `.environment(attachmentRepo)`
- `package.json` — `@tiptap/extension-image`、devDep `@tiptap/html`

---

### Task 1: 附件資料表（schema + migration）

**Files:**
- Modify: `src/lib/db/schema.ts`（在 `tasks` 定義之後、`tags` 之前插入）
- Create: `drizzle/0011_task_attachments.sql`
- Create: `src/lib/attachments/constants.ts`

**Interfaces:**
- Produces: `taskAttachments` drizzle table；`ALLOWED_IMAGE_MIMES`, `MAX_ATTACHMENT_BYTES`, `MAX_DESCRIPTION_BYTES`, `MAX_IMAGE_EDGE`

- [ ] **Step 1: 常數檔**

```ts
// src/lib/attachments/constants.ts
export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

/** 伺服器硬上限：單張附件 5MB（客戶端縮圖後正常只有幾百 KB）。 */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
/** 卡片 description HTML 上限 1MB（防呆，不是功能）。 */
export const MAX_DESCRIPTION_BYTES = 1024 * 1024;
/** 客戶端縮圖：最長邊。 */
export const MAX_IMAGE_EDGE = 2048;
```

- [ ] **Step 2: schema 加表**

在 `src/lib/db/schema.ts` 第 1 行 import 加 `customType`，並在 `tasks` 之後加：

```ts
import { pgTable, text, integer, boolean, uniqueIndex, customType } from "drizzle-orm/pg-core";

// drizzle 沒內建 bytea；node-postgres 來回都是 Buffer。
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// 卡片內文圖片。內文只存 `<img src="/api/attachments/<id>">`，圖檔本體在這。
// 先存 Postgres（使用者決定）；之後搬物件儲存只要改 /api/attachments 路由，
// 內文零改動。task_id 可為 null：上傳時綁定、卡片刪除後 set null，交給
// scripts/reap-orphan-attachments.mjs 回收「沒被任何 description 引用」的 row。
export const taskAttachments = pgTable("task_attachments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
  mime: text("mime").notNull(),
  bytes: bytea("bytes").notNull(),
  size: integer("size").notNull(),
  width: integer("width"),
  height: integer("height"),
  createdAt: text("created_at").notNull(),
});
```

- [ ] **Step 3: migration SQL（手寫，風格同 0010）**

```sql
-- drizzle/0011_task_attachments.sql
-- 卡片內文圖片本體。內文 HTML 只放 `<img src="/api/attachments/<id>">`，
-- 這張表存 bytes。純新增、不動舊欄位 → dev/prod 共用 DB 可直接跑，
-- 先跑 migration 或先上 code 都安全。
--
-- Apply manually with:
--   psql "$DATABASE_URL" -f drizzle/0011_task_attachments.sql

CREATE TABLE IF NOT EXISTS "task_attachments" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "task_id" text REFERENCES "tasks"("id") ON DELETE SET NULL,
  "mime" text NOT NULL,
  "bytes" bytea NOT NULL,
  "size" integer NOT NULL,
  "width" integer,
  "height" integer,
  "created_at" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "task_attachments_user_id_idx" ON "task_attachments" ("user_id");
CREATE INDEX IF NOT EXISTS "task_attachments_task_id_idx" ON "task_attachments" ("task_id");
```

- [ ] **Step 4: 型別檢查 + 跑 migration（dev DB）**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: 無新錯誤（既有錯誤若有，與本任務無關的不管）。

Run: `psql "$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)" -f drizzle/0011_task_attachments.sql`
Expected: `CREATE TABLE` / `CREATE INDEX` ×2。

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts drizzle/0011_task_attachments.sql src/lib/attachments/constants.ts
git commit -m "feat(attachments): task_attachments 表 + migration 0011"
```

---

### Task 2: 圖片 magic bytes 判斷（純函式，TDD）

**Files:**
- Create: `src/lib/attachments/image-sniff.ts`
- Test: `src/lib/attachments/image-sniff.test.ts`

**Interfaces:**
- Produces: `sniffImageMime(bytes: Uint8Array): AllowedImageMime | null`

- [ ] **Step 1: 失敗測試**

```ts
// src/lib/attachments/image-sniff.test.ts
import { describe, it, expect } from "vitest";
import { sniffImageMime } from "./image-sniff";

const bytes = (...xs: number[]) => new Uint8Array(xs);
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

describe("sniffImageMime", () => {
  it("JPEG：FF D8 FF", () => {
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe("image/jpeg");
  });
  it("PNG：89 PNG\\r\\n 1A \\n", () => {
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0))).toBe("image/png");
  });
  it("GIF87a / GIF89a", () => {
    expect(sniffImageMime(bytes(...ascii("GIF89a"), 0, 0, 0, 0, 0, 0))).toBe("image/gif");
    expect(sniffImageMime(bytes(...ascii("GIF87a"), 0, 0, 0, 0, 0, 0))).toBe("image/gif");
  });
  it("WebP：RIFF....WEBP", () => {
    expect(sniffImageMime(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")))).toBe("image/webp");
  });
  it("RIFF 但不是 WEBP（例如 WAV）→ null", () => {
    expect(sniffImageMime(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
  });
  it("SVG / 文字 / 太短 → null", () => {
    expect(sniffImageMime(bytes(...ascii("<svg xmlns=\"http://www.w3.org/2000/svg\">")))).toBeNull();
    expect(sniffImageMime(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageMime(new Uint8Array(0))).toBeNull();
  });
});
```

- [ ] **Step 2: 跑，確認紅**

Run: `npx vitest run src/lib/attachments/image-sniff.test.ts`
Expected: FAIL — `Failed to resolve import "./image-sniff"`。

- [ ] **Step 3: 實作**

```ts
// src/lib/attachments/image-sniff.ts
import type { AllowedImageMime } from "./constants";

/**
 * 用檔頭 magic bytes 判斷圖片格式。不信任 Content-Type / 副檔名。
 * 只認 jpeg / png / gif / webp；其他（含 SVG）一律 null。
 */
export function sniffImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  const head6 = String.fromCharCode(...bytes.subarray(0, 6));
  if (head6 === "GIF87a" || head6 === "GIF89a") return "image/gif";
  const riff = String.fromCharCode(...bytes.subarray(0, 4));
  const webp = String.fromCharCode(...bytes.subarray(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}
```

- [ ] **Step 4: 跑，確認綠**

Run: `npx vitest run src/lib/attachments/image-sniff.test.ts`
Expected: 6 passed。

- [ ] **Step 5: Commit**

```bash
git add src/lib/attachments/image-sniff.ts src/lib/attachments/image-sniff.test.ts
git commit -m "feat(attachments): sniffImageMime（magic bytes 判格式）"
```

---

### Task 3: 附件網址改寫 + 允許的 src（純字串，Web / Apple 共用，TDD）

**Files:**
- Create: `src/components/editor/attachment-url.ts`
- Test: `src/components/editor/attachment-url.test.ts`

**Interfaces:**
- Produces:
  - `ATTACHMENT_API_PREFIX = "/api/attachments/"`
  - `ATTACHMENT_SCHEME_PREFIX = "nudge-attachment://attachment/"`
  - `attachmentApiUrl(id: string): string`
  - `isAllowedImageSrc(src: string | null | undefined): boolean` — 只接受上面兩種前綴 + 合法 id（`[A-Za-z0-9_-]{1,64}`）
  - `toNativeAttachmentURLs(html: string): string` — API → scheme
  - `toServerAttachmentURLs(html: string): string` — scheme → API

- [ ] **Step 1: 失敗測試**

```ts
// src/components/editor/attachment-url.test.ts
import { describe, it, expect } from "vitest";
import {
  attachmentApiUrl,
  isAllowedImageSrc,
  toNativeAttachmentURLs,
  toServerAttachmentURLs,
} from "./attachment-url";

describe("attachment-url", () => {
  it("attachmentApiUrl", () => {
    expect(attachmentApiUrl("abc_-9")).toBe("/api/attachments/abc_-9");
  });

  it("isAllowedImageSrc 接受 API 與 scheme 兩種、拒絕其他", () => {
    expect(isAllowedImageSrc("/api/attachments/V1StGXR8_Z5jdHi6B-myT")).toBe(true);
    expect(isAllowedImageSrc("nudge-attachment://attachment/V1StGXR8_Z5jdHi6B-myT")).toBe(true);
    expect(isAllowedImageSrc("https://evil.example/x.png")).toBe(false);
    expect(isAllowedImageSrc("blob:http://localhost/123")).toBe(false);
    expect(isAllowedImageSrc("data:image/png;base64,AAAA")).toBe(false);
    expect(isAllowedImageSrc("/api/attachments/")).toBe(false);
    expect(isAllowedImageSrc("/api/attachments/../users")).toBe(false);
    expect(isAllowedImageSrc(null)).toBe(false);
    expect(isAllowedImageSrc(undefined)).toBe(false);
  });

  const serverHtml =
    '<p>hi</p><img src="/api/attachments/abc123" data-attachment-id="abc123" width="10" height="20"><p>x</p>';
  const nativeHtml =
    '<p>hi</p><img src="nudge-attachment://attachment/abc123" data-attachment-id="abc123" width="10" height="20"><p>x</p>';

  it("toNativeAttachmentURLs / toServerAttachmentURLs 互為反函式", () => {
    expect(toNativeAttachmentURLs(serverHtml)).toBe(nativeHtml);
    expect(toServerAttachmentURLs(nativeHtml)).toBe(serverHtml);
    expect(toServerAttachmentURLs(toNativeAttachmentURLs(serverHtml))).toBe(serverHtml);
  });

  it("不碰 href 或其他屬性裡的同字串", () => {
    const html = '<a href="/api/attachments/abc123">link</a>';
    expect(toNativeAttachmentURLs(html)).toBe(html);
  });

  it("多張圖都改", () => {
    const html = '<img src="/api/attachments/a1"><img src="/api/attachments/b2">';
    expect(toNativeAttachmentURLs(html)).toBe(
      '<img src="nudge-attachment://attachment/a1"><img src="nudge-attachment://attachment/b2">',
    );
  });
});
```

- [ ] **Step 2: 跑，確認紅**

Run: `npx vitest run src/components/editor/attachment-url.test.ts`
Expected: FAIL（模組不存在）。

- [ ] **Step 3: 實作**

```ts
// src/components/editor/attachment-url.ts
//
// 純字串工具，Web 與 Apple bundle（經 @web-editor alias）共用。不得 import React。
//
// 內文 HTML 永遠存 `/api/attachments/<id>`（server form）。Apple 的 WKWebView
// <img> 不會帶 Bearer，所以 load() 前改成 `nudge-attachment://attachment/<id>`
// 交給 AttachmentSchemeHandler 代抓；getHTML() / change 前改回來，保證三邊
// HTML byte-identical。

export const ATTACHMENT_API_PREFIX = "/api/attachments/";
export const ATTACHMENT_SCHEME_PREFIX = "nudge-attachment://attachment/";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function attachmentApiUrl(id: string): string {
  return `${ATTACHMENT_API_PREFIX}${id}`;
}

export function isAllowedImageSrc(src: string | null | undefined): boolean {
  if (!src) return false;
  for (const prefix of [ATTACHMENT_API_PREFIX, ATTACHMENT_SCHEME_PREFIX]) {
    if (src.startsWith(prefix)) return ID_RE.test(src.slice(prefix.length));
  }
  return false;
}

const SRC_API_RE = /src="\/api\/attachments\/([A-Za-z0-9_-]{1,64})"/g;
const SRC_SCHEME_RE = /src="nudge-attachment:\/\/attachment\/([A-Za-z0-9_-]{1,64})"/g;

export function toNativeAttachmentURLs(html: string): string {
  return html.replace(SRC_API_RE, `src="${ATTACHMENT_SCHEME_PREFIX}$1"`);
}

export function toServerAttachmentURLs(html: string): string {
  return html.replace(SRC_SCHEME_RE, `src="${ATTACHMENT_API_PREFIX}$1"`);
}
```

- [ ] **Step 4: 跑，確認綠**

Run: `npx vitest run src/components/editor/attachment-url.test.ts`
Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/attachment-url.ts src/components/editor/attachment-url.test.ts
git commit -m "feat(editor): attachment-url — API/scheme 雙向改寫 + isAllowedImageSrc"
```

---

### Task 4: `hasVisibleContent` + 純圖卡片不被列表過濾（TDD）

**Files:**
- Modify: `src/lib/strip-html.ts`
- Create: `src/lib/strip-html.test.ts`
- Modify: `src/app/api/cards/route.ts:64-73`
- Modify: `src/components/cards/card-detail.tsx:98-109`

**Interfaces:**
- Produces: `hasVisibleContent(html: string | null | undefined): boolean` — 去 tag 後有字 **或** 含 `<img`（排除 `data-upload-pending`）

- [ ] **Step 1: 失敗測試**

```ts
// src/lib/strip-html.test.ts
import { describe, it, expect } from "vitest";
import { stripHtml, hasVisibleContent } from "./strip-html";

describe("stripHtml", () => {
  it("去 tag、decode entity、壓空白", () => {
    expect(stripHtml("<p>a&nbsp;&amp;</p><p>b</p>")).toBe("a & b");
  });
});

describe("hasVisibleContent", () => {
  it("空 / 只有空段落 → false", () => {
    expect(hasVisibleContent("")).toBe(false);
    expect(hasVisibleContent(null)).toBe(false);
    expect(hasVisibleContent("<p></p>")).toBe(false);
    expect(hasVisibleContent("<p>  </p><p></p>")).toBe(false);
  });
  it("有字 → true", () => {
    expect(hasVisibleContent("<p>hi</p>")).toBe(true);
  });
  it("只有圖片、沒有字 → true", () => {
    expect(hasVisibleContent('<img src="/api/attachments/abc" data-attachment-id="abc">')).toBe(true);
  });
  it("只有上傳中的 placeholder → false", () => {
    expect(hasVisibleContent('<img data-upload-pending="true">')).toBe(false);
  });
});
```

- [ ] **Step 2: 跑，確認紅**

Run: `npx vitest run src/lib/strip-html.test.ts`
Expected: FAIL — `hasVisibleContent is not a function`。

- [ ] **Step 3: 實作**

在 `src/lib/strip-html.ts` 末尾加：

```ts
/**
 * 卡片「有沒有內容」的唯一判準：去 tag 後有字，或含至少一張已上傳的圖片。
 * 列表過濾（/api/cards）與存檔前 isEmpty（card-detail / task-detail-modal）
 * 都走這裡，兩邊才不會對「純圖卡片」意見不一。
 */
export function hasVisibleContent(html: string | null | undefined): boolean {
  if (!html) return false;
  if (stripHtml(html).length > 0) return true;
  // <img ...> 但排除上傳中 placeholder（無 src、帶 data-upload-pending）
  const imgTags = html.match(/<img\b[^>]*>/g) ?? [];
  return imgTags.some((tag) => !/data-upload-pending=/.test(tag));
}
```

- [ ] **Step 4: 跑，確認綠**

Run: `npx vitest run src/lib/strip-html.test.ts`
Expected: 5 passed。

- [ ] **Step 5: 套用到列表 API 與存檔 isEmpty**

`src/app/api/cards/route.ts`：
```ts
// import 行改成
import { stripHtml, hasVisibleContent } from "@/lib/strip-html";
// filter 內
  const filtered = rows.filter((r) => {
    if (!hasVisibleContent(r.description)) return false;
    if (!q) return true;
    const plain = stripHtml(r.description!);
    return (
      r.title.toLowerCase().includes(lq) || plain.toLowerCase().includes(lq)
    );
  });
```

`src/components/cards/card-detail.tsx` 第 98-109 行的 `DebouncedSaver` callback 改成：
```ts
      new DebouncedSaver<string>((html) => {
        patchTaskRef.current({ description: hasVisibleContent(html) ? html : "" });
      }, 800)
```
並 import `hasVisibleContent` from `@/lib/strip-html`。

`src/components/task/task-detail-modal.tsx`：搜 `"<p></p>"`，若有同樣的 isEmpty 判斷，改成同一行 `hasVisibleContent(html) ? html : ""`。

- [ ] **Step 6: Build**

Run: `npx next build 2>&1 | tail -15`
Expected: 成功。

- [ ] **Step 7: Commit**

```bash
git add src/lib/strip-html.ts src/lib/strip-html.test.ts src/app/api/cards/route.ts src/components/cards/card-detail.tsx src/components/task/task-detail-modal.tsx
git commit -m "feat(cards): hasVisibleContent — 純圖卡片不再被列表/存檔當成空白"
```

---

### Task 5: 附件 API（POST / GET / DELETE）

**Files:**
- Create: `src/app/api/attachments/route.ts`
- Create: `src/app/api/attachments/[id]/route.ts`

**Interfaces:**
- Consumes: `taskAttachments`（Task 1）、`sniffImageMime`（Task 2）、常數（Task 1）、`getUser`、`notifyUserDevices`
- Produces:
  - `POST /api/attachments` multipart `file`, `taskId`, `width?`, `height?` → `201 { id, mime, size, width, height }`；`400 { error: "unsupported" | "missing_file" | "missing_task" }`；`404` task 不是你的；`413 { error: "too_large" }`
  - `GET /api/attachments/[id]` → 圖片 bytes；`404` 不存在或不是你的
  - `DELETE /api/attachments/[id]` → `{ success: true }`；`404`

- [ ] **Step 1: POST**

```ts
// src/app/api/attachments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { taskAttachments, tasks } from "@/lib/db/schema";
import { getUser } from "@/lib/get-user";
import { sniffImageMime } from "@/lib/attachments/image-sniff";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments/constants";

/** 0 < n ≤ 20000 的整數才收；其他當沒給。寬高只拿來預留版面，不信任。 */
function parseDimension(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 && n <= 20000 ? n : null;
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const taskId = form.get("taskId");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (typeof taskId !== "string" || !taskId) {
    return NextResponse.json({ error: "missing_task" }, { status: 400 });
  }
  // 先看 Blob.size 擋大檔，別把 50MB 先讀進記憶體再拒絕。
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
    .limit(1);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageMime(new Uint8Array(buf.subarray(0, 16)));
  if (!mime) return NextResponse.json({ error: "unsupported" }, { status: 400 });

  const row = {
    id: nanoid(),
    userId: user.id,
    taskId,
    mime,
    bytes: buf,
    size: buf.length,
    width: parseDimension(form.get("width")),
    height: parseDimension(form.get("height")),
    createdAt: new Date().toISOString(),
  };
  await db.insert(taskAttachments).values(row);

  return NextResponse.json(
    { id: row.id, mime: row.mime, size: row.size, width: row.width, height: row.height },
    { status: 201 },
  );
}
```

- [ ] **Step 2: GET / DELETE**

```ts
// src/app/api/attachments/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { taskAttachments } from "@/lib/db/schema";
import { getUser } from "@/lib/get-user";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [row] = await db
    .select()
    .from(taskAttachments)
    .where(and(eq(taskAttachments.id, id), eq(taskAttachments.userId, user.id)))
    .limit(1);
  // 不是你的 / 不存在都回 404，不給探測空間。
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(row.bytes), {
    status: 200,
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(row.size),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // 附件內容不可變（改圖 = 新 id），私有快取可以永久留。
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: `"${row.id}"`,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await db
    .delete(taskAttachments)
    .where(and(eq(taskAttachments.id, id), eq(taskAttachments.userId, user.id)))
    .returning({ id: taskAttachments.id });
  if (deleted.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Build**

Run: `npx next build 2>&1 | tail -15`
Expected: 成功，route list 出現 `/api/attachments` 與 `/api/attachments/[id]`。

- [ ] **Step 4: 用 curl 實測（dev server + 瀏覽器 cookie）**

1. `npm run dev`，瀏覽器登入 `http://localhost:3000`，DevTools → Application → Cookies 複製 `authjs.session-token`（名稱以實際為準）值為 `$COOKIE`。
2. 取一張你自己的卡片 id 為 `$TASK`（卡片網址最後一段）。
3. 準備一張小 PNG：`python3 -c "import zlib,struct;sig=b'\x89PNG\r\n\x1a\n';open('/tmp/t.png','wb').write(sig+b'\x00\x00\x00\rIHDR'+struct.pack('>IIBBBBB',1,1,8,2,0,0,0)+b'\x90wS\xde')"`
4. 上傳：
   `curl -s -o /dev/stdout -w '\n%{http_code}\n' -b "authjs.session-token=$COOKIE" -F file=@/tmp/t.png -F taskId=$TASK -F width=1 -F height=1 http://localhost:3000/api/attachments`
   Expected: `201` + JSON 含 `id`、`mime: "image/png"`。記下 `$ID`。
5. 取圖：`curl -s -D - -o /tmp/out.png -b "authjs.session-token=$COOKIE" http://localhost:3000/api/attachments/$ID | head -8`
   Expected: `200`、`Content-Type: image/png`、`Cache-Control: private, max-age=31536000, immutable`；`cmp /tmp/t.png /tmp/out.png` 無輸出（相同）。
6. 未登入：`curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/attachments/$ID` → `401`。
7. 不存在：`curl -s -o /dev/null -w '%{http_code}\n' -b "authjs.session-token=$COOKIE" http://localhost:3000/api/attachments/nope` → `404`。
8. SVG 拒收：`printf '<svg xmlns="http://www.w3.org/2000/svg"></svg>' > /tmp/t.svg; curl -s -w '\n%{http_code}\n' -b "authjs.session-token=$COOKIE" -F file=@/tmp/t.svg -F taskId=$TASK http://localhost:3000/api/attachments` → `400 {"error":"unsupported"}`。
9. 超大：`head -c 6000000 /dev/zero > /tmp/big.bin; curl -s -w '\n%{http_code}\n' -b "authjs.session-token=$COOKIE" -F file=@/tmp/big.bin -F taskId=$TASK http://localhost:3000/api/attachments` → `413`。
10. 刪除：`curl -s -X DELETE -w '\n%{http_code}\n' -b "authjs.session-token=$COOKIE" http://localhost:3000/api/attachments/$ID` → `200 {"success":true}`；再 GET → `404`。

把實際結果貼進 commit message 或回報。任一條不符 → 修到符合再往下。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/attachments
git commit -m "feat(api): /api/attachments POST/GET/DELETE（magic bytes 驗證、5MB、owner-only 404）"
```

---

### Task 6: description 1MB 上限

**Files:**
- Modify: `src/app/api/tasks/[id]/route.ts:75-78`

- [ ] **Step 1: 在 `updates` 組裝前加檢查**

```ts
import { MAX_DESCRIPTION_BYTES } from "@/lib/attachments/constants";
// ...
  if (
    typeof body.description === "string" &&
    Buffer.byteLength(body.description, "utf8") > MAX_DESCRIPTION_BYTES
  ) {
    return NextResponse.json({ error: "description_too_large" }, { status: 413 });
  }

  const updates: Record<string, unknown> = { updatedAt: now };
```

- [ ] **Step 2: Build + curl**

Run: `npx next build 2>&1 | tail -5`
Run: `node -e "process.stdout.write(JSON.stringify({description:'<p>'+'x'.repeat(1100000)+'</p>'}))" > /tmp/big.json; curl -s -X PATCH -w '\n%{http_code}\n' -b "authjs.session-token=$COOKIE" -H 'Content-Type: application/json' --data-binary @/tmp/big.json http://localhost:3000/api/tasks/$TASK`
Expected: `413 {"error":"description_too_large"}`；該卡片內文未被改動（重新整理確認）。

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/tasks/[id]/route.ts"
git commit -m "feat(api): PATCH /api/tasks/[id] description 上限 1MB → 413"
```

---

### Task 7: i18n 字串（canonical → sync → en/ja → xcstrings）

**Files:**
- Modify: `i18n/canonical/zh-TW.json`（`editor` 區塊）、`i18n/canonical/en.json`、`i18n/canonical/ja.json`
- Modify: `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`

- [ ] **Step 1: zh-TW 加 key**（`editor` 區塊內，放在 `slashDividerKeywords` 之後）

```json
    "slashImageLabel": "圖片",
    "slashImageDescription": "上傳一張圖片",
    "slashImageKeywords": "image|img|picture|photo|圖片|圖|照片",
    "imageUploadingAria": "圖片上傳中",
    "imageUploadFailed": "圖片上傳失敗，請再試一次",
    "imageTooLarge": "圖片超過 5MB，請先縮小",
    "imageUnsupported": "只支援 JPEG、PNG、WebP、GIF",
    "imageSelectedAria": "已選取圖片，按 Delete 可移除"
```

- [ ] **Step 2: sync → 產 pending**

Run: `npm run i18n:sync`
Expected: 產生 `i18n/.pending-translations.md` 列出 8 個 key。

- [ ] **Step 3: 補 en / ja**（直接寫進 canonical/en.json、canonical/ja.json 的 `editor` 區塊）

en：
```json
    "slashImageLabel": "Image",
    "slashImageDescription": "Upload an image",
    "slashImageKeywords": "image|img|picture|photo",
    "imageUploadingAria": "Uploading image",
    "imageUploadFailed": "Image upload failed. Please try again.",
    "imageTooLarge": "Image is larger than 5MB. Please shrink it first.",
    "imageUnsupported": "Only JPEG, PNG, WebP and GIF are supported",
    "imageSelectedAria": "Image selected. Press Delete to remove."
```
ja：
```json
    "slashImageLabel": "画像",
    "slashImageDescription": "画像をアップロード",
    "slashImageKeywords": "image|img|picture|photo|画像|写真",
    "imageUploadingAria": "画像をアップロード中",
    "imageUploadFailed": "画像のアップロードに失敗しました。もう一度お試しください。",
    "imageTooLarge": "画像が 5MB を超えています。先に縮小してください。",
    "imageUnsupported": "JPEG、PNG、WebP、GIF のみ対応しています",
    "imageSelectedAria": "画像を選択中。Delete で削除できます。"
```

- [ ] **Step 4: 再 sync + check**

Run: `npm run i18n:sync && npm run i18n:check`
Expected: pending 檔消失；`src/messages/{zh-TW,en,ja}.json` 有新 key；check 通過。

- [ ] **Step 5: xcstrings 鏡像**（Mac `/` 選單批次 2 會用；現在一起鏡像免得漏）

在 `Localizable.xcstrings` 的 `strings` 加 `editor.slashImageLabel` / `editor.slashImageDescription` / `editor.slashImageKeywords` 三個 key，格式照 `editor.slashBulletLabel`（`extractionState: "manual"`，`en` / `ja` / `zh-Hant` 三個 `stringUnit`，`state: "translated"`，值同上）。

Run: `python3 -c "import json;json.load(open('apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings'))" && echo ok`
Expected: `ok`。

- [ ] **Step 6: Commit**

```bash
git add i18n/canonical src/messages apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings
git commit -m "i18n(editor): 圖片插入 / 上傳狀態字串（zh-TW/en/ja + xcstrings 鏡像）"
```

---

### Task 8: 共用 `AttachmentImage` node（純 ProseMirror，TDD）

**Files:**
- Modify: `package.json`（`@tiptap/extension-image@3.22.3` dependency；`@tiptap/html@3.22.3` devDependency）
- Create: `src/components/editor/attachment-image.ts`
- Test: `src/components/editor/attachment-image.test.ts`

**Interfaces:**
- Consumes: `isAllowedImageSrc`, `attachmentApiUrl`（Task 3）
- Produces:
  - `AttachmentImage` — TipTap node，`name = "image"`，`inline: false`，`draggable: false`，attrs `src | attachmentId | uploadId(不輸出) | width | height | alt`
  - options：`onPickFiles?: () => void`
  - commands：
    - `insertUploadingImage(attrs: { uploadId: string; previewSrc: string; width?: number; height?: number }, pos?: number): boolean`
    - `finalizeImageUpload(uploadId: string, result: { id: string; width: number | null; height: number | null }): boolean`
    - `failImageUpload(uploadId: string): boolean`
    - `requestImagePick(): boolean`（有 `onPickFiles` 才回 true）
  - helper：`findUploadingImage(doc, uploadId): { pos: number; node: Node } | null`

- [ ] **Step 1: 裝套件**

Run: `npm i @tiptap/extension-image@3.22.3 && npm i -D @tiptap/html@3.22.3`
Expected: package.json 兩行新增；`npm ls @tiptap/core` 只有一個 3.22.x。

- [ ] **Step 2: 失敗測試**

```ts
// src/components/editor/attachment-image.test.ts
import { describe, it, expect } from "vitest";
import { generateHTML, generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import { AttachmentImage } from "./attachment-image";

const exts = [StarterKit, AttachmentImage];
const roundtrip = (html: string) => generateHTML(generateJSON(html, exts), exts);

describe("AttachmentImage parse / render", () => {
  it("保留附件圖片與屬性", () => {
    const html =
      '<p>a</p><img src="/api/attachments/abc_1" data-attachment-id="abc_1" width="800" height="600" alt=""><p>b</p>';
    expect(roundtrip(html)).toBe(html);
  });

  it("drops external img on parse", () => {
    const html = '<p>a</p><img src="https://evil.example/x.png"><p>b</p>';
    expect(roundtrip(html)).toBe("<p>a</p><p>b</p>");
  });

  it("也接受 nudge-attachment scheme（Apple 端 load 後的形態）", () => {
    const html =
      '<img src="nudge-attachment://attachment/abc_1" data-attachment-id="abc_1" alt="">';
    expect(roundtrip(html)).toBe(html);
  });

  it("renders pending upload without src", () => {
    const json = {
      type: "doc",
      content: [
        { type: "image", attrs: { src: "blob:http://x/1", uploadId: "u1", attachmentId: null, width: null, height: null, alt: "" } },
      ],
    };
    const html = generateHTML(json, exts);
    expect(html).toBe('<img data-upload-pending="true" alt="">');
    // 再 parse 回來會被丟掉（沒有合法 src）
    expect(roundtrip(html)).toBe("");
  });

  it("不解析 data: / blob: src", () => {
    expect(roundtrip('<img src="data:image/png;base64,AAAA">')).toBe("");
    expect(roundtrip('<img src="blob:http://localhost/1">')).toBe("");
  });
});
```

- [ ] **Step 3: 跑，確認紅**

Run: `npx vitest run src/components/editor/attachment-image.test.ts`
Expected: FAIL（模組不存在）。

- [ ] **Step 4: 實作**

```ts
// src/components/editor/attachment-image.ts
//
// 卡片內文圖片 node。純 ProseMirror / TipTap，Web 與 Apple bundle 共用
// （Apple 經 @web-editor alias import）。不得 import React。
//
// 內文形態：<img src="/api/attachments/<id>" data-attachment-id="<id>" width height alt="">
// 上傳中：attrs.uploadId 有值、src 是 blob: 預覽；序列化時不輸出 src（避免把
// blob: 存進 DB），改輸出 data-upload-pending，重新 parse 會被丟掉。
import Image from "@tiptap/extension-image";
import type { Node as PMNode } from "@tiptap/pm/model";
import { attachmentApiUrl, isAllowedImageSrc } from "./attachment-url";

export interface AttachmentImageOptions {
  /** `/` 選單「圖片」或其他入口要開檔案選擇器時呼叫；沒設 = 此平台不給上傳。 */
  onPickFiles?: () => void;
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    attachmentImage: {
      insertUploadingImage: (
        attrs: { uploadId: string; previewSrc: string; width?: number; height?: number },
        pos?: number,
      ) => ReturnType;
      finalizeImageUpload: (
        uploadId: string,
        result: { id: string; width: number | null; height: number | null },
      ) => ReturnType;
      failImageUpload: (uploadId: string) => ReturnType;
      requestImagePick: () => ReturnType;
    };
  }
}

export function findUploadingImage(
  doc: PMNode,
  uploadId: string,
): { pos: number; node: PMNode } | null {
  let found: { pos: number; node: PMNode } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "image" && node.attrs.uploadId === uploadId) {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

export const AttachmentImage = Image.extend<AttachmentImageOptions>({
  inline: false,
  group: "block",
  // 關掉 ProseMirror 原生拖曳 — 區塊移動一律走 use-block-drag 的把手，
  // 否則圖片會多一套「直接按住圖拖」的行為，和檔案拖放撞在一起。
  draggable: false,

  addOptions() {
    return {
      ...this.parent?.(),
      onPickFiles: undefined,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      attachmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-attachment-id"),
        renderHTML: (attrs) =>
          attrs.attachmentId ? { "data-attachment-id": attrs.attachmentId } : {},
      },
      width: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute("width");
          return v ? Number.parseInt(v, 10) || null : null;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => {
          const v = el.getAttribute("height");
          return v ? Number.parseInt(v, 10) || null : null;
        },
        renderHTML: (attrs) => (attrs.height ? { height: attrs.height } : {}),
      },
      // 上傳中的暫時識別；不輸出到 HTML。
      uploadId: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        // 回 false = 整個節點丟掉。外站 / data: / blob: 都不收。
        getAttrs: (el) =>
          isAllowedImageSrc((el as HTMLElement).getAttribute("src")) ? null : false,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    if (node.attrs.uploadId) {
      // 上傳中：不要把 blob: 存出去。
      const { src: _src, ...rest } = HTMLAttributes;
      void _src;
      return ["img", { "data-upload-pending": "true", ...rest }];
    }
    return ["img", HTMLAttributes];
  },

  addCommands() {
    return {
      insertUploadingImage:
        ({ uploadId, previewSrc, width, height }, pos) =>
        ({ chain, state }) => {
          const at = pos ?? state.selection.to;
          return chain()
            .insertContentAt(at, {
              type: this.name,
              attrs: {
                src: previewSrc,
                uploadId,
                width: width ?? null,
                height: height ?? null,
                attachmentId: null,
                alt: "",
              },
            })
            .run();
        },

      finalizeImageUpload:
        (uploadId, result) =>
        ({ tr, dispatch }) => {
          const hit = findUploadingImage(tr.doc, uploadId);
          if (!hit) return false;
          if (dispatch) {
            tr.setNodeMarkup(hit.pos, undefined, {
              ...hit.node.attrs,
              src: attachmentApiUrl(result.id),
              attachmentId: result.id,
              uploadId: null,
              width: result.width ?? hit.node.attrs.width,
              height: result.height ?? hit.node.attrs.height,
            });
            // 換網址不算一次「編輯」：⌘Z 不該退回 blob: 預覽。
            tr.setMeta("addToHistory", false);
          }
          return true;
        },

      failImageUpload:
        (uploadId) =>
        ({ tr, dispatch }) => {
          const hit = findUploadingImage(tr.doc, uploadId);
          if (!hit) return false;
          if (dispatch) {
            tr.delete(hit.pos, hit.pos + hit.node.nodeSize);
            tr.setMeta("addToHistory", false);
          }
          return true;
        },

      requestImagePick:
        () =>
        () => {
          const cb = this.options.onPickFiles;
          if (!cb) return false;
          cb();
          return true;
        },
    };
  },
});
```

- [ ] **Step 5: 跑，確認綠**

Run: `npx vitest run src/components/editor/attachment-image.test.ts`
Expected: 5 passed。若 `generateHTML` 把 `alt=""` 省略或屬性順序不同，**改測試的期望字串對齊實際輸出**（順序由 attrs 宣告順序決定），但「外站 img 被丟掉」「pending 無 src」兩條語意不能變。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/components/editor/attachment-image.ts src/components/editor/attachment-image.test.ts
git commit -m "feat(editor): AttachmentImage node（純 ProseMirror，Web/Apple 共用）"
```

---

### Task 9: Web 客戶端縮圖 + 上傳（純函式部分 TDD）

**Files:**
- Create: `src/lib/image-upload.ts`
- Test: `src/lib/image-upload.test.ts`

**Interfaces:**
- Produces:
  - `isSupportedImageFile(file: { type: string }): boolean`
  - `computeResizeTarget(w: number, h: number, maxEdge?: number): { width: number; height: number }`
  - `prepareImageForUpload(file: File): Promise<{ blob: Blob; mime: string; width: number; height: number }>`（瀏覽器 only）
  - `uploadAttachment(taskId: string, prepared: { blob: Blob; width: number; height: number }): Promise<{ id: string; width: number | null; height: number | null }>`
  - `class ImageUploadError extends Error { code: "imageTooLarge" | "imageUnsupported" | "imageUploadFailed" }`

- [ ] **Step 1: 失敗測試**

```ts
// src/lib/image-upload.test.ts
import { describe, it, expect } from "vitest";
import { isSupportedImageFile, computeResizeTarget } from "./image-upload";

describe("isSupportedImageFile", () => {
  it("四種格式 true，其他 false", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(isSupportedImageFile({ type: t })).toBe(true);
    }
    expect(isSupportedImageFile({ type: "image/svg+xml" })).toBe(false);
    expect(isSupportedImageFile({ type: "image/heic" })).toBe(false);
    expect(isSupportedImageFile({ type: "application/pdf" })).toBe(false);
    expect(isSupportedImageFile({ type: "" })).toBe(false);
  });
});

describe("computeResizeTarget", () => {
  it("小於上限不動", () => {
    expect(computeResizeTarget(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it("橫圖以寬為準等比縮", () => {
    expect(computeResizeTarget(4096, 3072)).toEqual({ width: 2048, height: 1536 });
  });
  it("直圖以高為準等比縮", () => {
    expect(computeResizeTarget(1500, 6000)).toEqual({ width: 512, height: 2048 });
  });
  it("四捨五入後至少 1px", () => {
    expect(computeResizeTarget(10000, 1)).toEqual({ width: 2048, height: 1 });
  });
  it("可指定上限", () => {
    expect(computeResizeTarget(1000, 500, 100)).toEqual({ width: 100, height: 50 });
  });
});
```

- [ ] **Step 2: 跑，確認紅**

Run: `npx vitest run src/lib/image-upload.test.ts`
Expected: FAIL。

- [ ] **Step 3: 實作**

```ts
// src/lib/image-upload.ts
import {
  ALLOWED_IMAGE_MIMES,
  MAX_ATTACHMENT_BYTES,
  MAX_IMAGE_EDGE,
} from "@/lib/attachments/constants";

export type ImageUploadErrorCode = "imageTooLarge" | "imageUnsupported" | "imageUploadFailed";

export class ImageUploadError extends Error {
  constructor(public code: ImageUploadErrorCode) {
    super(code);
  }
}

export function isSupportedImageFile(file: { type: string }): boolean {
  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(file.type);
}

export function computeResizeTarget(
  w: number,
  h: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / Math.max(w, h);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * 上傳前瘦身：最長邊 ≤ 2048，輸出 WebP 0.85（瀏覽器不支援 WebP 編碼就 JPEG）。
 * GIF 原樣送（保留動畫）。回傳的 width/height 是最終尺寸。
 */
export async function prepareImageForUpload(
  file: File,
): Promise<{ blob: Blob; mime: string; width: number; height: number }> {
  if (!isSupportedImageFile(file)) throw new ImageUploadError("imageUnsupported");

  const bitmap = await createImageBitmap(file);
  try {
    if (file.type === "image/gif") {
      if (file.size > MAX_ATTACHMENT_BYTES) throw new ImageUploadError("imageTooLarge");
      return { blob: file, mime: file.type, width: bitmap.width, height: bitmap.height };
    }

    const { width, height } = computeResizeTarget(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageUploadError("imageUploadFailed");
    ctx.drawImage(bitmap, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, "image/webp", 0.85);
    // Safari 舊版 toBlob('image/webp') 會回 PNG；型別不對就改 JPEG。
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
    }
    if (!blob) throw new ImageUploadError("imageUploadFailed");
    if (blob.size > MAX_ATTACHMENT_BYTES) throw new ImageUploadError("imageTooLarge");
    return { blob, mime: blob.type, width, height };
  } finally {
    bitmap.close();
  }
}

export async function uploadAttachment(
  taskId: string,
  prepared: { blob: Blob; width: number; height: number },
): Promise<{ id: string; width: number | null; height: number | null }> {
  const form = new FormData();
  form.append("file", prepared.blob, "image");
  form.append("taskId", taskId);
  form.append("width", String(prepared.width));
  form.append("height", String(prepared.height));

  let res: Response;
  try {
    res = await fetch("/api/attachments", { method: "POST", body: form });
  } catch {
    throw new ImageUploadError("imageUploadFailed");
  }
  if (res.status === 413) throw new ImageUploadError("imageTooLarge");
  if (res.status === 400) throw new ImageUploadError("imageUnsupported");
  if (!res.ok) throw new ImageUploadError("imageUploadFailed");
  const json = (await res.json()) as { id: string; width: number | null; height: number | null };
  return { id: json.id, width: json.width ?? prepared.width, height: json.height ?? prepared.height };
}
```

- [ ] **Step 4: 跑，確認綠**

Run: `npx vitest run src/lib/image-upload.test.ts`
Expected: 6 passed。

- [ ] **Step 5: Commit**

```bash
git add src/lib/image-upload.ts src/lib/image-upload.test.ts
git commit -m "feat(web): image-upload — 客戶端縮圖 + POST /api/attachments 封裝"
```

---

### Task 10: Web node view + 編輯器掛載 + 樣式

**Files:**
- Create: `src/components/editor/attachment-image-node-view.tsx`
- Modify: `src/components/editor/editor-extensions.ts`
- Modify: `src/app/globals.css`（`.tiptap hr` 規則之後）

**Interfaces:**
- Consumes: `AttachmentImage`（Task 8）
- Produces: `createEditorExtensions({ ..., image?: { onPickFiles?: () => void } })` — 給 `image` 才掛 Image node（notes canvas 不給 → 不掛）

- [ ] **Step 1: node view**

```tsx
// src/components/editor/attachment-image-node-view.tsx
"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

/**
 * 卡片圖片區塊。上傳中：blob 預覽 + 半透明遮罩 + 轉圈；完成：正式網址。
 * 選取時主色外框；Backspace / Delete 交給 ProseMirror 預設（NodeSelection）。
 */
export function AttachmentImageNodeView({ node, selected }: NodeViewProps) {
  const t = useTranslations("editor");
  const uploading = Boolean(node.attrs.uploadId);
  const { src, width, height, alt } = node.attrs as {
    src: string | null;
    width: number | null;
    height: number | null;
    alt: string | null;
  };

  return (
    <NodeViewWrapper
      className={`nudge-image-block relative my-3 ${selected ? "is-selected" : ""}`}
      data-uploading={uploading ? "true" : undefined}
      aria-label={uploading ? t("imageUploadingAria") : selected ? t("imageSelectedAria") : undefined}
    >
      {src && (
        <img
          src={src}
          width={width ?? undefined}
          height={height ?? undefined}
          alt={alt ?? ""}
          draggable={false}
          className="block max-w-full h-auto rounded-md"
        />
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60">
          <Loader2 className="h-6 w-6 animate-spin text-text-dim" aria-hidden="true" />
        </div>
      )}
    </NodeViewWrapper>
  );
}
```

- [ ] **Step 2: 掛進 `createEditorExtensions`**

```ts
// src/components/editor/editor-extensions.ts — 新增 import
import { AttachmentImage } from "./attachment-image";
import { AttachmentImageNodeView } from "./attachment-image-node-view";

interface CreateEditorExtensionsOptions {
  placeholder: string;
  slashItems: SlashCommandItem[];
  taskList?: boolean;
  codeBlock?: boolean;
  /** 給了才掛圖片 node（卡片 / 任務描述）。notes canvas 不給。 */
  image?: { onPickFiles?: () => void };
}

export function createEditorExtensions({
  placeholder, slashItems, taskList = true, codeBlock = true, image,
}: CreateEditorExtensionsOptions) {
  // ...既有內容不動...
  if (image) {
    extensions.push(
      AttachmentImage.extend({
        addNodeView() {
          return ReactNodeViewRenderer(AttachmentImageNodeView);
        },
      }).configure({ onPickFiles: image.onPickFiles }) as any,
    );
  }
  return extensions;
}
```

- [ ] **Step 3: CSS**（`src/app/globals.css`，`.tiptap-container .tiptap hr` 規則後面）

```css
.tiptap-container .tiptap .nudge-image-block img {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
}

.tiptap-container .tiptap .nudge-image-block.is-selected img {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.tiptap-container .tiptap .nudge-image-block[data-uploading="true"] img {
  opacity: 0.6;
}
```

- [ ] **Step 4: Build**

Run: `npx next build 2>&1 | tail -10`
Expected: 成功（此時還沒有入口，功能不可見，但型別要過）。

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/attachment-image-node-view.tsx src/components/editor/editor-extensions.ts src/app/globals.css
git commit -m "feat(editor): 圖片 node view（上傳中/選取狀態）+ 掛進 createEditorExtensions"
```

---

### Task 11: 三個入口（拖檔、貼上、`/` 圖片）+ 錯誤橫幅

**Files:**
- Create: `src/components/editor/file-drag.ts` + `file-drag.test.ts`
- Create: `src/components/editor/use-image-upload.ts`
- Modify: `src/components/editor/slash-command-defs.ts`、`slash-command-items.tsx`
- Modify: `src/components/task/tiptap-editor.tsx`
- Modify: `src/components/cards/card-detail.tsx:266-272`、`src/components/task/task-detail-modal.tsx:264`

**Interfaces:**
- Consumes: Task 8 commands、Task 9 函式、Task 10 `image` option
- Produces:
  - `isFileDrag(types: readonly string[] | DOMStringList | undefined): boolean`
  - `pickImageFiles(list: FileList | File[] | null | undefined): File[]`
  - `useImageUpload(editor, taskId, onError): (files: File[], pos?: number) => Promise<void>`
  - `TiptapEditor` 新 prop：`attachmentTaskId?: string`（有給才啟用圖片）

- [ ] **Step 1: `file-drag` 失敗測試**

```ts
// src/components/editor/file-drag.test.ts
import { describe, it, expect } from "vitest";
import { isFileDrag, pickImageFiles } from "./file-drag";

describe("isFileDrag", () => {
  it("types 含 Files → true", () => {
    expect(isFileDrag(["Files"])).toBe(true);
    expect(isFileDrag(["text/plain", "Files"])).toBe(true);
  });
  it("內部區塊拖曳（無 Files）→ false", () => {
    expect(isFileDrag(["text/html"])).toBe(false);
    expect(isFileDrag([])).toBe(false);
    expect(isFileDrag(undefined)).toBe(false);
  });
});

describe("pickImageFiles", () => {
  const f = (type: string) => ({ type }) as File;
  it("只留支援的圖片、保留順序", () => {
    expect(pickImageFiles([f("image/png"), f("text/plain"), f("image/gif")]).map((x) => x.type))
      .toEqual(["image/png", "image/gif"]);
  });
  it("null → []", () => {
    expect(pickImageFiles(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑，確認紅；實作**

Run: `npx vitest run src/components/editor/file-drag.test.ts` → FAIL。

```ts
// src/components/editor/file-drag.ts
import { isSupportedImageFile } from "@/lib/image-upload";

/** 這次 DnD 是不是「從外面拖檔案進來」（而不是把手的區塊拖曳）。 */
export function isFileDrag(types: readonly string[] | DOMStringList | undefined): boolean {
  if (!types) return false;
  return Array.from(types as ArrayLike<string>).includes("Files");
}

export function pickImageFiles(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list as ArrayLike<File>).filter(isSupportedImageFile);
}
```

Run: `npx vitest run src/components/editor/file-drag.test.ts` → 4 passed。

- [ ] **Step 3: 上傳流程 hook**

```ts
// src/components/editor/use-image-upload.ts
"use client";

import { useCallback } from "react";
import type { Editor } from "@tiptap/core";
import { nanoid } from "nanoid";
import {
  ImageUploadError,
  prepareImageForUpload,
  uploadAttachment,
  type ImageUploadErrorCode,
} from "@/lib/image-upload";

/**
 * 三個入口共用：對每個檔案 → 立刻插「上傳中」節點（blob 預覽）→ 縮圖 → POST
 * → finalize（換成 /api/attachments/<id>）；任一步失敗 → 移除那一格 + onError。
 * 多檔依序插在同一個位置之後（每張 nodeSize = 1，所以 pos 每次 +1）。
 */
export function useImageUpload(
  editor: Editor | null,
  taskId: string | undefined,
  onError: (code: ImageUploadErrorCode) => void,
) {
  return useCallback(
    async (files: File[], pos?: number) => {
      if (!editor || !taskId || files.length === 0) return;
      let nextPos = pos;

      const jobs = files.map((file) => {
        const uploadId = nanoid();
        const previewSrc = URL.createObjectURL(file);
        const inserted = editor.commands.insertUploadingImage({ uploadId, previewSrc }, nextPos);
        if (nextPos !== undefined && inserted) nextPos += 1;
        return { file, uploadId, previewSrc };
      });

      await Promise.all(
        jobs.map(async ({ file, uploadId, previewSrc }) => {
          try {
            const prepared = await prepareImageForUpload(file);
            const result = await uploadAttachment(taskId, prepared);
            editor.commands.finalizeImageUpload(uploadId, result);
          } catch (e) {
            editor.commands.failImageUpload(uploadId);
            onError(e instanceof ImageUploadError ? e.code : "imageUploadFailed");
          } finally {
            URL.revokeObjectURL(previewSrc);
          }
        }),
      );
    },
    [editor, taskId, onError],
  );
}
```

- [ ] **Step 4: `/` 圖片項**

`slash-command-defs.ts` 在 `divider` 之前加：
```ts
  {
    id: "image",
    requiredExtension: "image",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      editor.commands.requestImagePick();
    },
  },
```
`slash-command-items.tsx`：import `ImageIcon` from lucide（`import { ..., Image as ImageIcon } from "lucide-react"`），`ID_TO_ICON` 加 `image: ImageIcon`，`ID_TO_KEY` 加 `image: { label: "slashImageLabel", description: "slashImageDescription", keywords: "slashImageKeywords" }`。

- [ ] **Step 5: `TiptapEditor` 接三入口 + 橫幅**

改寫 `src/components/task/tiptap-editor.tsx`（完整檔）：

```tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { createEditorExtensions } from "@/components/editor/editor-extensions";
import { useSlashCommandItems } from "@/components/editor/slash-command-items";
import { useBlockDrag } from "@/components/editor/use-block-drag";
import { BlockDragHandle, BlockDropIndicator } from "@/components/editor/block-drag-handle";
import { useImageUpload } from "@/components/editor/use-image-upload";
import { isFileDrag, pickImageFiles } from "@/components/editor/file-drag";
import type { ImageUploadErrorCode } from "@/lib/image-upload";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
  /** 有給才啟用圖片（拖檔 / 貼上 / `/` 圖片）；上傳綁到這張卡片。 */
  attachmentTaskId?: string;
}

export const TiptapEditor = forwardRef<{ focus: () => void }, TiptapEditorProps>(
  function TiptapEditor(
    { content, onChange, onBlur, placeholder = "", autoFocus = false, editable = true, attachmentTaskId },
    ref,
  ) {
    const t = useTranslations("editor");
    const slashItems = useSlashCommandItems();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadError, setUploadError] = useState<ImageUploadErrorCode | null>(null);

    const editor = useEditor({
      immediatelyRender: false,
      extensions: createEditorExtensions({
        placeholder,
        slashItems,
        image: attachmentTaskId
          ? { onPickFiles: () => fileInputRef.current?.click() }
          : undefined,
      }),
      content,
      editable,
      autofocus: autoFocus ? "end" : false,
      onUpdate: ({ editor }) => onChange(editor.getHTML()),
      onBlur: () => onBlur?.(),
      editorProps: {
        attributes: { class: "outline-none min-h-[50vh]" },
        // 拖檔：只接「外部檔案」，把手的區塊拖曳（無 Files type）照舊交給 useBlockDrag。
        handleDrop: (view, event) => {
          if (!attachmentTaskId || !isFileDrag(event.dataTransfer?.types)) return false;
          const files = pickImageFiles(event.dataTransfer?.files);
          if (files.length === 0) return false;
          event.preventDefault();
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const pos = coords ? afterTopLevelBlock(view.state.doc, coords.pos) : view.state.doc.content.size;
          void uploadFilesRef.current(files, pos);
          return true;
        },
        handlePaste: (view, event) => {
          if (!attachmentTaskId) return false;
          const files = pickImageFiles(event.clipboardData?.files);
          if (files.length === 0) return false;
          event.preventDefault();
          const pos = afterTopLevelBlock(view.state.doc, view.state.selection.to);
          void uploadFilesRef.current(files, pos);
          return true;
        },
      },
    });

    const showError = useCallback((code: ImageUploadErrorCode) => setUploadError(code), []);
    const uploadFiles = useImageUpload(editor, attachmentTaskId, showError);
    // editorProps 在 useEditor 建立時就固定，handler 透過 ref 拿到最新的 uploadFiles。
    const uploadFilesRef = useRef(uploadFiles);
    useEffect(() => {
      uploadFilesRef.current = uploadFiles;
    }, [uploadFiles]);

    useEffect(() => {
      if (!uploadError) return;
      const id = setTimeout(() => setUploadError(null), 4000);
      return () => clearTimeout(id);
    }, [uploadError]);

    const { containerRef, hoveredBlock, dropIndicatorTop, containerProps, handleDragStart, handleDragEnd } =
      useBlockDrag(editor);

    useImperativeHandle(ref, () => ({ focus: () => editor?.commands.focus("end") }));

    useEffect(() => {
      if (editor) editor.setEditable(editable);
    }, [editor, editable]);

    return (
      <div ref={containerRef} {...containerProps} className="tiptap-container h-full relative md:pl-6 md:-ml-6">
        {uploadError && (
          <div
            role="alert"
            className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 bg-destructive/10 text-sm text-foreground"
          >
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
            {t(uploadError)}
          </div>
        )}
        {hoveredBlock && (
          <BlockDragHandle hoveredBlock={hoveredBlock} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
        )}
        {dropIndicatorTop !== null && <BlockDropIndicator top={dropIndicatorTop} />}
        <EditorContent editor={editor} className="h-full" />
        {attachmentTaskId && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = pickImageFiles(e.target.files);
              e.target.value = "";
              if (!editor || files.length === 0) return;
              const pos = afterTopLevelBlock(editor.state.doc, editor.state.selection.to);
              void uploadFiles(files, pos);
            }}
          />
        )}
      </div>
    );
  },
);

/** 把任意 doc 位置換算成「所在頂層區塊之後」的插入點（圖片永遠是頂層區塊）。 */
function afterTopLevelBlock(doc: import("@tiptap/pm/model").Node, pos: number): number {
  const $pos = doc.resolve(Math.min(pos, doc.content.size));
  return $pos.depth === 0 ? $pos.pos : $pos.after(1);
}
```

`uploadError` 的 key 直接對應 i18n：`imageTooLarge` / `imageUnsupported` / `imageUploadFailed`（Task 7 已加）。

- [ ] **Step 6: 兩個呼叫點傳 `attachmentTaskId`**

`card-detail.tsx`：`<TiptapEditor ... attachmentTaskId={id} />`。
`task-detail-modal.tsx`：`<TiptapEditor ... attachmentTaskId={task.id} />`。

- [ ] **Step 7: Build + lint**

Run: `npx next build 2>&1 | tail -10 && npm run lint 2>&1 | tail -10`
Expected: 成功、無新 lint error。

- [ ] **Step 8: Commit**

```bash
git add src/components/editor/file-drag.ts src/components/editor/file-drag.test.ts src/components/editor/use-image-upload.ts src/components/editor/slash-command-defs.ts src/components/editor/slash-command-items.tsx src/components/task/tiptap-editor.tsx src/components/cards/card-detail.tsx src/components/task/task-detail-modal.tsx
git commit -m "feat(editor): 圖片三入口（拖檔 / 貼上 / slash）+ 上傳錯誤橫幅"
```

---

### Task 12: Web 完整流程實測（Definition of Done）

**Files:** 無（手動）。若有 bug，修在對應檔案並補進對應 Task 的 commit 範圍。

- [ ] **Step 1: 啟 dev server，開一張卡片**

Run: `npm run dev` → `http://localhost:3000/cards/<id>`。

- [ ] **Step 2: 逐條走，每條在回報裡寫「通過 / 失敗 + 現象」**

| # | 操作 | 期望 |
|---|---|---|
| 1 | 從 Finder 拖一張 JPG 到兩段文字之間放開 | 立即出現預覽+轉圈；<2s 換成正式圖；位置在放手處的區塊之後 |
| 2 | 同時拖 3 張 | 3 個區塊、順序同 Finder 選取順序 |
| 3 | 截圖後 ⌘V | 圖插在游標所在段落之後 |
| 4 | 打 `/`、輸入 `img` 或 `圖` | 出現「圖片」項；Enter 跳檔案選擇；選檔後插入 |
| 5 | 拖一個 `.svg` / `.pdf` 進來 | 不插入；頂部出現「只支援 JPEG、PNG、WebP、GIF」橫幅，4 秒消失 |
| 6 | 拖一張 >5MB 的 GIF | 不插入；「圖片超過 5MB」橫幅 |
| 7 | 把手拖圖片到兩段文字之間 | 指示線正確；放開後圖片移動；文字不變 |
| 8 | 把手拖段落到圖片上方/下方 | 同上 |
| 9 | 拖檔案時滑過把手區 | 不會觸發區塊拖曳；放開仍是上傳 |
| 10 | 點圖片 → Backspace | 圖片刪除；⌘Z 回來（網址仍是 /api/attachments/…，不是 blob:） |
| 11 | 上傳完等 1 秒、重新整理 | 圖片還在、位置正確 |
| 12 | 新卡片只放一張圖、不打字、回列表 | 卡片出現在列表（不被當空白） |
| 13 | DevTools Network：第二次載入同一張圖 | 來自 disk cache（Cache-Control 生效） |
| 14 | 關 dev server 後再拖一張圖 | 預覽出現 → 消失 + 「上傳失敗」橫幅；文字內容不受影響 |
| 15 | 開另一個分頁同一張卡 → 這邊插圖 → 那邊打字存檔 | 那邊 409 重載後圖片仍在（內文不會被 blob: 污染） |
| 16 | 手機寬度（DevTools 375px） | 圖片不超出寬度；把手本來就隱藏 |

- [ ] **Step 3: 全部通過後 commit 任何修正**

```bash
git add -A src && git commit -m "fix(editor): 圖片流程實測修正" # 只有有修改時
```

---

### Task 13: Apple bundle 認得圖片（顯示；不上傳）

**Files:**
- Modify: `apple/NudgeEditor/package.json`（`"@tiptap/extension-image": "3.22.3"`）
- Modify: `apple/NudgeEditor/src/main.ts`
- Modify: `apple/NudgeEditor/src/theme.css`
- Create: `apple/NudgeEditor/src/attachment-rewrite.test.ts`（驗 alias 下 import 得到、改寫可用）

**Interfaces:**
- Consumes: `AttachmentImage`（`@web-editor/attachment-image`）、`toNativeAttachmentURLs` / `toServerAttachmentURLs`（`@web-editor/attachment-url`）
- Produces: bundle 在 `load()` 改寫成 scheme、在 `getHTML()` 與 `change` 改回 server form

- [ ] **Step 1: 裝套件**

Run: `cd apple/NudgeEditor && npm i @tiptap/extension-image@3.22.3 && cd ../..`
Expected: `apple/NudgeEditor/package.json` dependencies 多一行，版本釘死 `3.22.3`。

- [ ] **Step 2: 失敗測試（alias + 改寫在 jsdom 環境可用）**

```ts
// apple/NudgeEditor/src/attachment-rewrite.test.ts
import { describe, it, expect } from "vitest";
import { toNativeAttachmentURLs, toServerAttachmentURLs } from "@web-editor/attachment-url";
import { AttachmentImage } from "@web-editor/attachment-image";

describe("attachment rewrite via @web-editor alias", () => {
  it("雙向改寫", () => {
    const server = '<img src="/api/attachments/abc" data-attachment-id="abc">';
    const native = toNativeAttachmentURLs(server);
    expect(native).toContain('src="nudge-attachment://attachment/abc"');
    expect(toServerAttachmentURLs(native)).toBe(server);
  });
  it("AttachmentImage 可載入且 name 是 image", () => {
    expect(AttachmentImage.name).toBe("image");
  });
});
```

Run: `cd apple/NudgeEditor && npx vitest run src/attachment-rewrite.test.ts; cd ../..`
Expected: FAIL（`@web-editor/attachment-url` 的 alias 在 vitest.config 沒設 → 先把 vite.config 的 alias 複製到 `vitest.config.ts`）：

```ts
// apple/NudgeEditor/vitest.config.ts
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: { "@web-editor": resolve(__dirname, "../../src/components/editor") },
  },
  test: { environment: "jsdom" },
  css: { postcss: { plugins: [] } },
});
```

再跑 → 2 passed。

- [ ] **Step 3: `main.ts` 掛 node + 改寫 + 擋 file drop**

```ts
// 新增 import
import { AttachmentImage } from "@web-editor/attachment-image";
import { toNativeAttachmentURLs, toServerAttachmentURLs } from "@web-editor/attachment-url";

// buildSlashItems()：批次 1 Apple 不給上傳 → 把 image 項藏掉（批次 2 接 bridge 後拿掉這行）
function buildSlashItems(): SlashCommandItem[] {
  return SLASH_COMMAND_DEFS.filter((def) => def.id !== "image").map((def) => { /* 不變 */ });
}

// createEditor() extensions 陣列，放在 Link 之後：
      // 卡片圖片。批次 1：只顯示。onPickFiles 不設 → requestImagePick 回 false。
      AttachmentImage,

// onUpdate 改成：
    onUpdate: ({ editor: ed }) => {
      postToNative({ kind: "change", html: toServerAttachmentURLs(ed.getHTML()) });
      postToNative({ kind: "selection", active: computeActive() });
    },

// createEditor() 末尾（ResizeObserver 之前）加：
  // 檔案拖進 WKWebView 預設會「導航到該檔案」把編輯器換掉。批次 1 不上傳，
  // 一律吃掉；批次 2 改成走 bridge 上傳。
  for (const type of ["dragover", "drop"] as const) {
    document.addEventListener(type, (e) => {
      const dt = (e as DragEvent).dataTransfer;
      if (dt && Array.from(dt.types).includes("Files")) e.preventDefault();
    });
  }

// api.load / api.getHTML 改成：
  load(html: string) {
    if (!editor) return;
    editor.commands.setContent(toNativeAttachmentURLs(html || ""), { emitUpdate: false });
  },
  getHTML() {
    return toServerAttachmentURLs(editor?.getHTML() ?? "");
  },
```

- [ ] **Step 4: 樣式**（`theme.css`，`.ProseMirror hr` 之後）

```css
.ProseMirror img {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 0.75em 0;
}
.ProseMirror img.ProseMirror-selectednode {
    outline: 2px solid var(--nudge-primary);
    outline-offset: 2px;
}
```

- [ ] **Step 5: Build bundle**

Run: `./apple/NudgeEditor/build.sh`
Expected: `✓ editor bundle copied`；`git status` 顯示 `apple/NudgeKit/Sources/NudgeUI/Resources/Editor/editor.js` 變動。

- [ ] **Step 6: Commit**

```bash
git add apple/NudgeEditor apple/NudgeKit/Sources/NudgeUI/Resources/Editor
git commit -m "feat(apple-editor): bundle 認得卡片圖片（scheme 改寫、擋 file drop、批次 1 只顯示）"
```

---

### Task 14: Swift — `AttachmentRepository` + `WKURLSchemeHandler` + 注入

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeCore/APIClient.swift`（加 `getData`）
- Create: `apple/NudgeKit/Sources/NudgeCore/AttachmentRepository.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/AttachmentRepositoryTests.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Components/AttachmentSchemeHandler.swift`
- Modify: `apple/NudgeKit/Sources/NudgeUI/Components/RichTextEditor.swift`（`makeUIView` / `makeNSView` 註冊 handler；讀 env）
- Modify: `apple/Nudge-iOS/NudgeiOSApp.swift:85,139`、`apple/Nudge-macOS/NudgeMacApp.swift:60,98,179`

**Interfaces:**
- Produces:
  - `APIClient.getData(_ path: String) async throws -> (Data, String?)` — raw GET，回 bytes + Content-Type；404 丟 `APIError`（沿用既有 error mapping）
  - `AttachmentRepository.imageData(id: String) async throws -> (Data, String)` — NSCache 命中直接回；否則 `getData("/api/attachments/\(id)")`；磁碟層靠 URLSession 預設 URLCache（server 已回 `Cache-Control: private, max-age=…`）
  - `AttachmentSchemeHandler(repository:)` — scheme `nudge-attachment`，從 `url.lastPathComponent` 取 id

- [ ] **Step 1: 失敗測試**

```swift
// apple/NudgeKit/Tests/NudgeCoreTests/AttachmentRepositoryTests.swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("AttachmentRepository", .serialized) struct AttachmentRepositoryTests {
    private func makeClient() -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://example.test")!),
            session: URLSession(configuration: config),
            tokenProvider: { "tok" }
        )
    }

    @Test @MainActor func fetchesBytesWithBearerAndCachesSecondHit() async throws {
        var hits = 0
        MockURLProtocol.handler = { request in
            hits += 1
            #expect(request.url?.path == "/api/attachments/abc")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer tok")
            let data = Data([0xff, 0xd8, 0xff])
            let response = HTTPURLResponse(
                url: request.url!, statusCode: 200, httpVersion: nil,
                headerFields: ["Content-Type": "image/jpeg"]
            )!
            return (data, response)
        }
        let repo = AttachmentRepository(client: makeClient())
        let (d1, m1) = try await repo.imageData(id: "abc")
        #expect(d1 == Data([0xff, 0xd8, 0xff]))
        #expect(m1 == "image/jpeg")
        let (d2, _) = try await repo.imageData(id: "abc")
        #expect(d2 == d1)
        #expect(hits == 1)
    }

    @Test @MainActor func notFoundThrows() async {
        MockURLProtocol.handler = { request in
            let response = HTTPURLResponse(url: request.url!, statusCode: 404, httpVersion: nil, headerFields: nil)!
            return (Data("{\"error\":\"Not found\"}".utf8), response)
        }
        let repo = AttachmentRepository(client: makeClient())
        await #expect(throws: (any Error).self) {
            _ = try await repo.imageData(id: "nope")
        }
    }
}
```

（`MockURLProtocol` 已存在於 `Tests/NudgeCoreTests/Helpers`，簽名照 `APIClientTests.swift` 用法。）

- [ ] **Step 2: 跑，確認紅**

Run: `cd apple/NudgeKit && swift test --filter AttachmentRepositoryTests 2>&1 | tail -15; cd ../..`
Expected: 編譯失敗（`AttachmentRepository` 不存在）。

- [ ] **Step 3: `APIClient.getData`**

在 `APIClient.swift` 的 `get<Response>` 之後加：

```swift
    /// Raw GET：回 bytes + Content-Type，不走 JSON decode。給附件圖片用。
    /// 404 / 401 等沿用 perform 的狀態碼處理（401 會觸發 unauthorizedHandler）。
    public func getData(_ path: String) async throws -> (Data, String?) {
        var request = try buildRequest(method: "GET", path: path, body: nil as Empty?)
        request.setValue("*/*", forHTTPHeaderField: "Accept")
        let (data, urlResponse): (Data, URLResponse)
        do {
            (data, urlResponse) = try await session.data(for: request)
        } catch {
            throw APIError.network(underlying: error)
        }
        guard let http = urlResponse as? HTTPURLResponse else { throw APIError.invalidResponse }
        switch http.statusCode {
        case 200...299:
            return (data, http.value(forHTTPHeaderField: "Content-Type"))
        case 401:
            if let handler = currentUnauthorizedHandler() { await handler() }
            throw APIError.unauthorized
        default:
            throw APIError.httpError(statusCode: http.statusCode, data: data)
        }
    }
```

（`APIError` case 名稱以 `APIError.swift` 實際定義為準；若無 `httpError(statusCode:data:)`，用既有對應 4xx/5xx 的 case。）

- [ ] **Step 4: `AttachmentRepository`**

```swift
// apple/NudgeKit/Sources/NudgeCore/AttachmentRepository.swift
import Foundation
import Observation

/// 卡片內文圖片。WKWebView 的 <img> 不會帶 Bearer，所以由 AttachmentSchemeHandler
/// 透過這裡代抓。記憶體 NSCache；磁碟靠 URLSession 預設 URLCache（server 回
/// `Cache-Control: private, max-age=31536000, immutable`，URLCache 是 private cache
/// 可以存）。
@Observable
@MainActor
public final class AttachmentRepository {
    private let client: APIClient
    private let cache = NSCache<NSString, CachedImage>()

    final class CachedImage {
        let data: Data
        let mime: String
        init(data: Data, mime: String) { self.data = data; self.mime = mime }
    }

    public init(client: APIClient) {
        self.client = client
        cache.totalCostLimit = 64 * 1024 * 1024
    }

    public func imageData(id: String) async throws -> (Data, String) {
        if let hit = cache.object(forKey: id as NSString) {
            return (hit.data, hit.mime)
        }
        let (data, contentType) = try await client.getData("/api/attachments/\(id)")
        let mime = contentType ?? "application/octet-stream"
        cache.setObject(CachedImage(data: data, mime: mime), forKey: id as NSString, cost: data.count)
        return (data, mime)
    }
}
```

- [ ] **Step 5: 跑測試，確認綠**

Run: `cd apple/NudgeKit && swift test --filter AttachmentRepositoryTests 2>&1 | tail -15; cd ../..`
Expected: 2 passed。

- [ ] **Step 6: Scheme handler**

```swift
// apple/NudgeKit/Sources/NudgeUI/Components/AttachmentSchemeHandler.swift
import Foundation
import WebKit
import NudgeCore

/// 攔 `nudge-attachment://attachment/<id>` → AttachmentRepository 代抓（帶 Bearer）。
/// WebKit 規定：task 被 stop 之後不得再呼叫 didReceive / didFinish（會 crash），
/// 所以用 `stopped` 集合守住。
@MainActor
final class AttachmentSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "nudge-attachment"

    private let repository: AttachmentRepository
    private var stopped = Set<ObjectIdentifier>()

    init(repository: AttachmentRepository) {
        self.repository = repository
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let key = ObjectIdentifier(urlSchemeTask)
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        let id = url.lastPathComponent
        guard !id.isEmpty, id != "attachment" else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let (data, mime) = try await self.repository.imageData(id: id)
                guard !self.stopped.contains(key) else { return }
                let response = URLResponse(
                    url: url, mimeType: mime, expectedContentLength: data.count, textEncodingName: nil
                )
                urlSchemeTask.didReceive(response)
                urlSchemeTask.didReceive(data)
                urlSchemeTask.didFinish()
            } catch {
                guard !self.stopped.contains(key) else { return }
                urlSchemeTask.didFailWithError(error)
            }
            self.stopped.remove(key)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        stopped.insert(ObjectIdentifier(urlSchemeTask))
    }
}
```

- [ ] **Step 7: 註冊到 WKWebViewConfiguration + 從 environment 拿 repo**

`RichTextEditor.swift`：
- `RichTextEditor` struct 加 `@Environment(AttachmentRepository.self) private var attachmentRepo: AttachmentRepository?`，並把 `attachmentRepo` 作為新參數傳給 `UIKitEditor(...)` / `AppKitEditor(...)`（兩個 struct 各加 `let attachmentRepo: AttachmentRepository?`）。
- `makeUIView` 與 `makeNSView` 在 `let config = WKWebViewConfiguration()` 之後、`WKWebView(frame:configuration:)` 之前加：

```swift
        if let attachmentRepo {
            config.setURLSchemeHandler(
                AttachmentSchemeHandler(repository: attachmentRepo),
                forURLScheme: AttachmentSchemeHandler.scheme
            )
        }
```

兩個 App：
- `NudgeiOSApp.swift` 第 85 行附近加 `let attachmentRepo = AttachmentRepository(client: client)`，第 139 行附近（`.environment(cardRepo)` 旁）加 `.environment(attachmentRepo)`。
- `NudgeMacApp.swift` 第 60 行附近加同一行；第 98 與 179 行兩處 `.environment(cardRepo)` 旁各加 `.environment(attachmentRepo)`。

- [ ] **Step 8: 全 target build（iOS + macOS）**

Run:
```bash
cd apple && xcodegen generate >/dev/null && \
xcodebuild -scheme Nudge-iOS -destination 'generic/platform=iOS Simulator' -derivedDataPath ~/Library/Developer/Xcode/DerivedData/nudge-ops-ios build 2>&1 | grep -E "error:|BUILD" | head -20 && \
xcodebuild -scheme Nudge-macOS -destination 'platform=macOS' -derivedDataPath ~/Library/Developer/Xcode/DerivedData/nudge-ops-mac build 2>&1 | grep -E "error:|BUILD" | head -20; cd ..
```
Expected: 兩個 `** BUILD SUCCEEDED **`。（scheme 名稱以 `xcodebuild -list` 為準。）

- [ ] **Step 9: 模擬器 / Mac 實測（iOS 顯示 + 資料不遺失）**

1. Web 先在某張卡片放兩張圖、中間夾一段文字。
2. iOS 模擬器（Debug build 打 localhost:3000）登入同帳號 → 開那張卡：**看得到兩張圖**，位置正確。
3. iOS 在文字段落打一個字、等 1 秒、回列表再進來：圖片仍在。Web 重新整理：圖片仍在、新字也在（這條就是 spec §5 的資料遺失風險驗證）。
4. Mac App 開同一張卡：看得到圖；從 Finder 拖一張圖到編輯器上：**不會**把編輯器換成那張圖的頁面（擋 file drop 生效），也不會插入任何東西。
5. 把 Web 那張圖刪掉後 iOS 再開：圖片位置變空、不 crash（scheme handler 404 → `didFailWithError`，WebKit 顯示破圖或空白）。

把 5 條結果寫進回報。

- [ ] **Step 10: Commit**

```bash
git add apple/NudgeKit apple/Nudge-iOS/NudgeiOSApp.swift apple/Nudge-macOS/NudgeMacApp.swift
git commit -m "feat(apple): AttachmentRepository + nudge-attachment scheme handler（卡片圖片顯示）"
```

---

### Task 15: 孤兒附件清理 script

**Files:**
- Create: `scripts/reap-orphan-attachments.mjs`

**Interfaces:**
- 用法：`node scripts/reap-orphan-attachments.mjs [--dry-run] [--grace-hours=24]`；DATABASE_URL 從 `.env.local` 讀（同 `seed-demo-card.mjs`）

- [ ] **Step 1: 寫 script**

```js
#!/usr/bin/env node
// scripts/reap-orphan-attachments.mjs
// 刪掉「沒有任何 tasks.description 引用、且建立超過 grace 小時」的附件。
// grace 緩衝涵蓋「上傳了還沒存檔」與「undo 把圖片拉回來」兩種情況。
//
// 用法：
//   node scripts/reap-orphan-attachments.mjs --dry-run          # 只列不刪
//   node scripts/reap-orphan-attachments.mjs                    # 刪（grace 24h）
//   node scripts/reap-orphan-attachments.mjs --grace-hours=72
//
// 引用判斷用 position(id in description) > 0（精確子字串），不用 LIKE —
// nanoid 含 `_`，LIKE 會把它當萬用字元。
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error(`找不到 ${envPath}`);
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
if (!env.DATABASE_URL) { console.error("DATABASE_URL 不在 .env.local"); process.exit(1); }

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const graceHours = Number((args.find((a) => a.startsWith("--grace-hours=")) ?? "--grace-hours=24").split("=")[1]);
const cutoff = new Date(Date.now() - graceHours * 3600 * 1000).toISOString();

const pool = new Pool({ connectionString: env.DATABASE_URL });
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
try {
  const { rows } = await pool.query(orphanSQL, [cutoff]);
  const total = rows.reduce((s, r) => s + Number(r.size), 0);
  console.log(`孤兒附件 ${rows.length} 筆，共 ${(total / 1024 / 1024).toFixed(2)} MB（created_at < ${cutoff}）`);
  for (const r of rows) console.log(`  ${r.id}  ${r.created_at}  ${r.size} bytes`);
  if (dryRun || rows.length === 0) { console.log(dryRun ? "(dry-run，未刪除)" : ""); process.exit(0); }
  const ids = rows.map((r) => r.id);
  const del = await pool.query(`DELETE FROM task_attachments WHERE id = ANY($1::text[])`, [ids]);
  console.log(`已刪除 ${del.rowCount} 筆`);
} finally {
  await pool.end();
}
```

- [ ] **Step 2: 實測（dev DB）**

1. 用 Task 5 的 curl 上傳一張圖但**不**插進任何卡片，記下 `$ID`。
2. `node scripts/reap-orphan-attachments.mjs --dry-run --grace-hours=0` → 列出 `$ID`，不刪。
3. `node scripts/reap-orphan-attachments.mjs --dry-run` → **不**列出（24h 內受保護）。
4. `node scripts/reap-orphan-attachments.mjs --grace-hours=0` → 刪除 1 筆；再 GET `$ID` → 404。
5. 確認 Web 卡片裡正在用的圖**沒有**被列出。

- [ ] **Step 3: Commit**

```bash
git add scripts/reap-orphan-attachments.mjs
git commit -m "chore(attachments): 孤兒附件清理 script（dry-run / grace）"
```

---

### Task 16: 文件 + 全部測試 + 收尾

**Files:**
- Modify: `apple/NudgeEditor/README.md`（一段：bundle 內 `/api/attachments` ↔ `nudge-attachment://` 改寫、批次 1 不上傳、`image` slash 項被 filter）
- Modify: `AGENTS.md` 「架構備忘」加一小節

- [ ] **Step 1: AGENTS.md 加節**

```markdown
## 卡片圖片 = 附件表 + 網址引用

- 圖檔在 `task_attachments`（bytea），內文只存 `<img src="/api/attachments/<id>" data-attachment-id=…>`。**改儲存後端只改 `/api/attachments` 路由，內文不動。**
- Image node 是純 ProseMirror（`src/components/editor/attachment-image.ts`），Web 與 Apple bundle 共用；**不認得的 node 會在 setContent 時被丟掉**，所以任何新 node 型別必須 Web + Apple bundle 同批上線，否則 App 一存檔就把它刪了。
- Apple 端 `load()` 把 src 改成 `nudge-attachment://attachment/<id>`，`getHTML()` 改回；`AttachmentSchemeHandler` 帶 Bearer 代抓。
- 孤兒回收：`node scripts/reap-orphan-attachments.mjs --dry-run`（24h grace）。
```

- [ ] **Step 2: 全套測試**

Run: `npm test 2>&1 | tail -8 && (cd apple/NudgeEditor && npx vitest run 2>&1 | tail -5) && (cd apple/NudgeKit && swift test 2>&1 | tail -5)`
Expected: 全綠。

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md apple/NudgeEditor/README.md
git commit -m "docs: 卡片圖片附件架構備忘 + Apple bundle README"
```

---

## 批次 2（另一份計畫，待本計畫完成後寫）

Mac 上傳三入口（bridge `upload` / `uploadResult`、`NSOpenPanel` 或 `<input type=file>` 二擇一、Finder 拖入 spike）+ Mac 拖曳把手（`use-block-drag.ts` 去 React 化）。前置：先做 30 分鐘 spike 確認 macOS WKWebView 的 `drop` 事件拿不拿得到 `dataTransfer.files`。
