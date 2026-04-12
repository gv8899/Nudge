# Nudge i18n Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Nudge i18n 基礎建設：canonical JSON + sync script、Web (next-intl) 接線、Mobile (gen-l10n) 接線、DB `users.locale` 持久化。本 plan 執行完成後，Web 可透過 `/en/*`、`/ja/*` URL prefix 切語言，Mobile 可透過 Riverpod provider 切語言，使用者偏好持久化到 DB，但尚未遷移任何實際 feature 文案（Phase 4-10 各自獨立 plan）。

**Architecture:** Canonical JSON (`i18n/canonical/zh-TW.json` 為 source of truth) → `sync.mjs` 用 Claude API 增量翻譯 en/ja、轉檔到 Web (`src/messages/*.json`) 和 Mobile (`mobile/lib/l10n/*.arb`)。Web 用 next-intl 搭配 `[locale]` App Router 目錄，Mobile 用官方 `flutter_localizations` + `gen-l10n`。使用者 locale 存在 `users.locale` 欄位，middleware/provider 自動 redirect/sync。

**Tech Stack:** Next.js 16 + next-intl 3、Flutter + flutter_localizations/gen-l10n、Drizzle ORM、Node.js + @anthropic-ai/sdk、vitest。

---

## 檔案結構

### 新增

**i18n tooling**（repo root）：
- `i18n/canonical/zh-TW.json` — 手改 source
- `i18n/canonical/en.json` — 生成
- `i18n/canonical/ja.json` — 生成
- `i18n/.i18n-cache.json` — hash 追蹤
- `i18n/scripts/sync.mjs` — 主 CLI
- `i18n/scripts/lib/diff.mjs` — diff 邏輯
- `i18n/scripts/lib/flatten.mjs` — 巢狀 → flat camelCase
- `i18n/scripts/lib/transpile.mjs` — JSON → ARB
- `i18n/scripts/lib/translate.mjs` — Claude API 呼叫
- `i18n/scripts/lib/*.test.mjs` — vitest 單元測試
- `i18n/README.md` — tooling 說明

**Web**：
- `src/i18n/routing.ts` — next-intl locales 定義
- `src/i18n/request.ts` — server-side 載入 messages
- `src/middleware.ts` — next-intl middleware（新）
- `src/app/[locale]/layout.tsx` — 新 locale layout
- `src/app/[locale]/(app)/...` — 從 `src/app/(app)/` 搬過來
- `src/messages/zh-TW.json` — 生成
- `src/messages/en.json` — 生成
- `src/messages/ja.json` — 生成

**Mobile**：
- `mobile/l10n.yaml` — gen-l10n 設定
- `mobile/lib/l10n/app_zh.arb` — 生成
- `mobile/lib/l10n/app_en.arb` — 生成
- `mobile/lib/l10n/app_ja.arb` — 生成
- `mobile/lib/l10n/app_localizations.dart` — `flutter gen-l10n` 自動生成（commit）
- `mobile/lib/core/locale_provider.dart` — Riverpod notifier

**DB**：
- `drizzle/NNNN_add_users_locale.sql` — migration
- `src/app/api/me/locale/route.ts` — PATCH endpoint

### 修改

- `package.json` — 加 `next-intl` + scripts
- `src/app/layout.tsx` — 拆掉原本的 locale-specific 邏輯
- `src/app/(app)/` 整批移除（移到 `[locale]` 下）
- `src/lib/db/schema.ts` — users 加 `locale` 欄位
- `src/app/api/me/route.ts` — 回傳加 `locale`
- `mobile/pubspec.yaml` — 加 `l10n` 設定
- `mobile/lib/app.dart` — MaterialApp 加 delegates
- `mobile/lib/features/auth/auth_provider.dart` — 登入後 sync locale
- `.gitignore` — 排除 `.i18n-cache.json` 的某些欄位（若有）

---

# Phase 0 — i18n Tooling 基礎建設

## Task 0.1: 建立 i18n 目錄結構和空 canonical 檔

**Files:**
- Create: `i18n/canonical/zh-TW.json`
- Create: `i18n/canonical/en.json`
- Create: `i18n/canonical/ja.json`
- Create: `i18n/.i18n-cache.json`
- Create: `i18n/README.md`

- [ ] **Step 1: 建立目錄和空 JSON 檔**

```bash
mkdir -p i18n/canonical i18n/scripts/lib
```

寫 `i18n/canonical/zh-TW.json`：
```json
{}
```

寫 `i18n/canonical/en.json`：
```json
{}
```

寫 `i18n/canonical/ja.json`：
```json
{}
```

寫 `i18n/.i18n-cache.json`：
```json
{
  "version": 1,
  "hashes": {},
  "locked": {}
}
```

- [ ] **Step 2: 寫 README 說明結構**

寫 `i18n/README.md`：
```markdown
# Nudge i18n Tooling

Single source of truth for all UI strings across Web and Mobile.

## 結構

- `canonical/zh-TW.json` — 手改 source（巢狀 JSON + ICU MessageFormat）
- `canonical/en.json` / `canonical/ja.json` — LLM 生成，人工 review
- `.i18n-cache.json` — hash 記錄和 lock 清單
- `scripts/sync.mjs` — 主腳本
- `scripts/lib/` — 子模組

## Workflow

1. 改 `canonical/zh-TW.json`（新增/修改/刪除 key）
2. 跑 `pnpm run i18n:sync`
3. Script 偵測 diff → 呼叫 Claude API 翻譯增量 → 寫回 en/ja
4. Script 轉檔到 Web (`src/messages/*.json`) 和 Mobile (`mobile/lib/l10n/*.arb`)
5. `git diff` 檢視翻譯結果、修 en/ja 中不滿意的文案
6. 若不希望某個 key 被自動覆蓋，在 `.i18n-cache.json` `locked` 加入該 key
7. Commit canonical + 生成檔

## CLI

- `pnpm run i18n:sync` — 全流程
- `pnpm run i18n:sync --dry` — 只 diff 不改檔（CI 用）
- `pnpm run i18n:sync --skip-llm` — 不呼叫 LLM，只轉檔
- `pnpm run i18n:sync --retranslate <key>` — 強制重翻某 key
```

- [ ] **Step 3: Commit**

```bash
git add i18n/canonical/ i18n/.i18n-cache.json i18n/README.md
git commit -m "chore(i18n): 建立 canonical JSON + cache 目錄結構"
```

---

## Task 0.2: 裝 vitest 和 @anthropic-ai/sdk 依賴

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安裝 dev dependency**

```bash
pnpm add -D vitest @anthropic-ai/sdk
```

- [ ] **Step 2: 加 npm scripts 到 `package.json`**

在 `"scripts"` 加入：
```json
{
  "i18n:sync": "node i18n/scripts/sync.mjs",
  "i18n:check": "node i18n/scripts/sync.mjs --dry",
  "i18n:test": "vitest run i18n/scripts"
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(i18n): 加 vitest + @anthropic-ai/sdk 依賴"
```

---

## Task 0.3: 實作 `diff.mjs` — SHA256-based canonical diff（TDD）

**Files:**
- Create: `i18n/scripts/lib/diff.mjs`
- Test: `i18n/scripts/lib/diff.test.mjs`

- [ ] **Step 1: 寫失敗測試**

寫 `i18n/scripts/lib/diff.test.mjs`：
```js
import { describe, it, expect } from 'vitest';
import { flattenDotPath, hashValue, diffCanonical } from './diff.mjs';

describe('flattenDotPath', () => {
  it('flattens nested object to dot-path entries', () => {
    const input = { a: { b: { c: 'hello' }, d: 'world' } };
    const result = flattenDotPath(input);
    expect(result).toEqual({
      'a.b.c': 'hello',
      'a.d': 'world',
    });
  });

  it('handles flat object', () => {
    expect(flattenDotPath({ x: '1', y: '2' })).toEqual({ x: '1', y: '2' });
  });

  it('handles empty object', () => {
    expect(flattenDotPath({})).toEqual({});
  });

  it('throws on non-string leaf', () => {
    expect(() => flattenDotPath({ a: 42 })).toThrow(/non-string leaf/);
  });
});

describe('hashValue', () => {
  it('produces stable SHA256 for same input', () => {
    expect(hashValue('hello')).toBe(hashValue('hello'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashValue('a')).not.toBe(hashValue('b'));
  });
});

describe('diffCanonical', () => {
  it('detects added keys', () => {
    const prev = { 'a.b': 'hashA' };
    const current = { 'a.b': '一', 'c.d': '二' };
    const result = diffCanonical(prev, current);
    expect(result.added).toEqual(['c.d']);
    expect(result.changed).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('detects changed keys by hash', () => {
    const prev = { 'a.b': hashValue('舊值') };
    const current = { 'a.b': '新值' };
    const result = diffCanonical(prev, current);
    expect(result.changed).toEqual(['a.b']);
  });

  it('detects removed keys', () => {
    const prev = { 'a.b': 'h', 'c.d': 'h2' };
    const current = { 'a.b': '一' };
    const result = diffCanonical(prev, current);
    expect(result.removed).toEqual(['c.d']);
  });

  it('treats unchanged keys as neither added/changed/removed', () => {
    const v = '不變';
    const prev = { 'a.b': hashValue(v) };
    const current = { 'a.b': v };
    const result = diffCanonical(prev, current);
    expect(result.added).toEqual([]);
    expect(result.changed).toEqual([]);
    expect(result.removed).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試驗證失敗**

```bash
pnpm run i18n:test
```
Expected: fail，`Cannot find module './diff.mjs'`

- [ ] **Step 3: 實作 `diff.mjs`**

寫 `i18n/scripts/lib/diff.mjs`：
```js
import { createHash } from 'node:crypto';

/**
 * 把巢狀物件展平成 dot-path → value 的 map
 * 例：{ a: { b: 'x' } } → { 'a.b': 'x' }
 * 葉節點必須是 string，否則丟錯
 */
export function flattenDotPath(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenDotPath(v, key));
    } else if (typeof v === 'string') {
      out[key] = v;
    } else {
      throw new Error(`canonical JSON has non-string leaf at ${key}: ${typeof v}`);
    }
  }
  return out;
}

/** 穩定 SHA256 */
export function hashValue(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * @param prevHashes {Record<string, string>}  上次記錄的 key → hash
 * @param currentValues {Record<string, string>}  現在的 key → raw value
 * @returns {{ added: string[], changed: string[], removed: string[] }}
 */
export function diffCanonical(prevHashes, currentValues) {
  const added = [];
  const changed = [];
  const removed = [];

  for (const [key, value] of Object.entries(currentValues)) {
    const currentHash = hashValue(value);
    if (!(key in prevHashes)) {
      added.push(key);
    } else if (prevHashes[key] !== currentHash) {
      changed.push(key);
    }
  }

  for (const key of Object.keys(prevHashes)) {
    if (!(key in currentValues)) removed.push(key);
  }

  return { added, changed, removed };
}
```

- [ ] **Step 4: 跑測試驗證通過**

```bash
pnpm run i18n:test
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add i18n/scripts/lib/diff.mjs i18n/scripts/lib/diff.test.mjs
git commit -m "feat(i18n): diff.mjs — SHA256-based canonical diff + flatten"
```

---

## Task 0.4: 實作 `flatten.mjs` — dot-path → ARB camelCase（TDD）

**Files:**
- Create: `i18n/scripts/lib/flatten.mjs`
- Test: `i18n/scripts/lib/flatten.test.mjs`

- [ ] **Step 1: 寫失敗測試**

寫 `i18n/scripts/lib/flatten.test.mjs`：
```js
import { describe, it, expect } from 'vitest';
import { toCamelCase, buildArbKeyMap } from './flatten.mjs';

describe('toCamelCase', () => {
  it('converts dot-path to camelCase', () => {
    expect(toCamelCase('settings.logout.button')).toBe('settingsLogoutButton');
  });

  it('handles single segment', () => {
    expect(toCamelCase('save')).toBe('save');
  });

  it('handles already-camelCase segments', () => {
    expect(toCamelCase('cards.emptyState')).toBe('cardsEmptyState');
  });

  it('handles underscores inside segments', () => {
    expect(toCamelCase('task.status.in_progress')).toBe('taskStatusInProgress');
  });
});

describe('buildArbKeyMap', () => {
  it('maps canonical dot-path keys to flat camelCase', () => {
    const canonical = {
      'settings.title': '設定',
      'cards.save': '儲存',
    };
    const result = buildArbKeyMap(canonical);
    expect(result).toEqual({
      settingsTitle: '設定',
      cardsSave: '儲存',
    });
  });

  it('detects collisions and throws', () => {
    const canonical = {
      'cards.save': 'A',
      'cardsSave': 'B',
    };
    expect(() => buildArbKeyMap(canonical)).toThrow(/collision/i);
  });
});
```

- [ ] **Step 2: 跑測試驗證失敗**

```bash
pnpm run i18n:test
```
Expected: fail，flatten.mjs 不存在

- [ ] **Step 3: 實作 `flatten.mjs`**

寫 `i18n/scripts/lib/flatten.mjs`：
```js
/**
 * dot-path → camelCase
 * 處理 snake_case 段：例 'task.status.in_progress' → 'taskStatusInProgress'
 */
export function toCamelCase(dotPath) {
  const segments = dotPath.split('.');
  return segments
    .map((seg, i) => {
      // snake_case 也要處理
      const parts = seg.split('_');
      return parts
        .map((p, j) => {
          if (i === 0 && j === 0) return p;
          return p.charAt(0).toUpperCase() + p.slice(1);
        })
        .join('');
    })
    .join('');
}

/**
 * @param canonical {Record<string, string>}  dot-path → value
 * @returns {Record<string, string>}  camelCase → value
 * @throws 若 flatten 後 key 碰撞
 */
export function buildArbKeyMap(canonical) {
  const out = {};
  const sourceOf = {}; // camelCase → 原 dot path

  for (const [dotKey, value] of Object.entries(canonical)) {
    const camelKey = toCamelCase(dotKey);
    if (camelKey in out) {
      throw new Error(
        `ARB key collision: "${camelKey}" from both "${sourceOf[camelKey]}" and "${dotKey}"`
      );
    }
    out[camelKey] = value;
    sourceOf[camelKey] = dotKey;
  }

  return out;
}
```

- [ ] **Step 4: 跑測試驗證通過**

```bash
pnpm run i18n:test
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add i18n/scripts/lib/flatten.mjs i18n/scripts/lib/flatten.test.mjs
git commit -m "feat(i18n): flatten.mjs — dot-path → ARB camelCase + collision detection"
```

---

## Task 0.5: 實作 `transpile.mjs` — 產生 ARB 格式含 metadata（TDD）

**Files:**
- Create: `i18n/scripts/lib/transpile.mjs`
- Test: `i18n/scripts/lib/transpile.test.mjs`

- [ ] **Step 1: 寫失敗測試**

寫 `i18n/scripts/lib/transpile.test.mjs`：
```js
import { describe, it, expect } from 'vitest';
import { extractIcuPlaceholders, buildArbJson } from './transpile.mjs';

describe('extractIcuPlaceholders', () => {
  it('extracts simple {name} placeholders', () => {
    expect(extractIcuPlaceholders('Hello {name}!')).toEqual(['name']);
  });

  it('extracts multiple placeholders', () => {
    expect(extractIcuPlaceholders('{a} and {b}')).toEqual(['a', 'b']);
  });

  it('extracts placeholder from plural with #', () => {
    const s = '{count, plural, one{# card} other{# cards}}';
    expect(extractIcuPlaceholders(s)).toEqual(['count']);
  });

  it('deduplicates repeated placeholders', () => {
    expect(extractIcuPlaceholders('{x} {x}')).toEqual(['x']);
  });

  it('returns empty for plain strings', () => {
    expect(extractIcuPlaceholders('Hello world')).toEqual([]);
  });
});

describe('buildArbJson', () => {
  it('produces ARB with @@locale and @key metadata for params', () => {
    const flat = {
      settingsTitle: '設定',
      cardsDeleted: '已清除 {count} 張空白卡片',
    };
    const result = buildArbJson(flat, 'zh');
    expect(result['@@locale']).toBe('zh');
    expect(result['settingsTitle']).toBe('設定');
    expect(result['@settingsTitle']).toEqual({});
    expect(result['cardsDeleted']).toBe('已清除 {count} 張空白卡片');
    expect(result['@cardsDeleted']).toEqual({
      placeholders: { count: { type: 'Object' } },
    });
  });

  it('extracts placeholder from plural format', () => {
    const flat = { cardCount: '{count, plural, other{# 張}}' };
    const result = buildArbJson(flat, 'zh');
    expect(result['@cardCount']).toEqual({
      placeholders: { count: { type: 'num' } },
    });
  });
});
```

- [ ] **Step 2: 跑測試驗證失敗**

```bash
pnpm run i18n:test
```

- [ ] **Step 3: 實作 `transpile.mjs`**

寫 `i18n/scripts/lib/transpile.mjs`：
```js
/**
 * 抽出 ICU message string 裡的 placeholder 名稱清單（去重）
 * 支援：{name}、{count, plural, ...}、{count, select, ...}
 */
export function extractIcuPlaceholders(str) {
  const names = new Set();
  // 匹配 { 後第一個識別字，直到空白 / , / }
  const re = /\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[,}\s]/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    names.add(m[1]);
  }
  return [...names];
}

/**
 * 是否該 ICU 是 plural / select 格式（決定 placeholder type）
 */
function isPluralOrSelect(str, placeholder) {
  const re = new RegExp(`\\{\\s*${placeholder}\\s*,\\s*(plural|selectordinal)`);
  return re.test(str);
}

/**
 * @param flat {Record<string, string>}  camelCase → value
 * @param localeTag {string}  'zh' | 'en' | 'ja'
 * @returns ARB JSON object
 */
export function buildArbJson(flat, localeTag) {
  const arb = { '@@locale': localeTag };
  for (const [key, value] of Object.entries(flat)) {
    arb[key] = value;
    const placeholders = extractIcuPlaceholders(value);
    const meta = {};
    if (placeholders.length > 0) {
      meta.placeholders = {};
      for (const p of placeholders) {
        meta.placeholders[p] = {
          type: isPluralOrSelect(value, p) ? 'num' : 'Object',
        };
      }
    }
    arb[`@${key}`] = meta;
  }
  return arb;
}
```

- [ ] **Step 4: 跑測試驗證通過**

```bash
pnpm run i18n:test
```

- [ ] **Step 5: Commit**

```bash
git add i18n/scripts/lib/transpile.mjs i18n/scripts/lib/transpile.test.mjs
git commit -m "feat(i18n): transpile.mjs — JSON → ARB 格式含 placeholder metadata"
```

---

## Task 0.6: 實作 `translate.mjs` — Claude API 增量翻譯

**Files:**
- Create: `i18n/scripts/lib/translate.mjs`
- Test: `i18n/scripts/lib/translate.test.mjs`

- [ ] **Step 1: 寫失敗測試（mock Anthropic client）**

寫 `i18n/scripts/lib/translate.test.mjs`：
```js
import { describe, it, expect, vi } from 'vitest';
import { translateIncremental } from './translate.mjs';

describe('translateIncremental', () => {
  it('returns empty when no keys to translate', async () => {
    const fakeClient = { messages: { create: vi.fn() } };
    const result = await translateIncremental({
      client: fakeClient,
      source: { 'a.b': '你好' },
      targetLang: 'en',
      keysToTranslate: [],
    });
    expect(result).toEqual({});
    expect(fakeClient.messages.create).not.toHaveBeenCalled();
  });

  it('parses Claude JSON response', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: 'text', text: '{"a.b": "Hello", "c.d": "World"}' },
          ],
        }),
      },
    };
    const result = await translateIncremental({
      client: fakeClient,
      source: { 'a.b': '你好', 'c.d': '世界' },
      targetLang: 'en',
      keysToTranslate: ['a.b', 'c.d'],
    });
    expect(result).toEqual({ 'a.b': 'Hello', 'c.d': 'World' });
  });

  it('extracts JSON even if wrapped in markdown fence', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: '```json\n{"a": "X"}\n```',
            },
          ],
        }),
      },
    };
    const result = await translateIncremental({
      client: fakeClient,
      source: { a: '甲' },
      targetLang: 'ja',
      keysToTranslate: ['a'],
    });
    expect(result).toEqual({ a: 'X' });
  });

  it('throws if Claude returns invalid JSON', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'not json' }],
        }),
      },
    };
    await expect(
      translateIncremental({
        client: fakeClient,
        source: { a: '甲' },
        targetLang: 'en',
        keysToTranslate: ['a'],
      })
    ).rejects.toThrow(/parse/i);
  });
});
```

- [ ] **Step 2: 跑測試驗證失敗**

```bash
pnpm run i18n:test
```

- [ ] **Step 3: 實作 `translate.mjs`**

寫 `i18n/scripts/lib/translate.mjs`：
```js
const LANG_NAMES = {
  en: 'English',
  ja: '日本語 (Japanese)',
};

function buildPrompt({ source, targetLang, keysToTranslate }) {
  const langName = LANG_NAMES[targetLang] || targetLang;
  const fullSource = JSON.stringify(source, null, 2);
  const keyList = keysToTranslate.map((k) => `- ${k}`).join('\n');

  return `你是 Nudge 這款個人生產力 App 的 UI 文案翻譯師。

Nudge 是繁中 UI，現在要多語化支援 ${langName}。我會給你完整的繁中 canonical 檔（JSON，dot-path key），你只翻譯指定清單裡的 key。

規則：
1. 翻成 ${langName}，語氣：簡短、動詞優先、非官方口吻（像寫給朋友的 App）
2. 保留 ICU MessageFormat placeholder（\`{name}\`、\`{count, plural, ...}\`）完全不動
3. 按鈕和 label 優先用動詞/名詞短語，不寫完整句子
4. 只翻指定的 key，其他略過
5. 回覆必須是純 JSON（key → 翻譯後字串），不要任何額外說明

完整 canonical 檔（繁中）：
\`\`\`json
${fullSource}
\`\`\`

要翻譯的 key（只翻這些）：
${keyList}

輸出格式（純 JSON）：
{
  "key1": "翻譯",
  "key2": "翻譯"
}`;
}

function extractJson(text) {
  // 處理可能的 markdown fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const raw = fenceMatch ? fenceMatch[1] : text;
  try {
    return JSON.parse(raw.trim());
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${e.message}\nResponse: ${text}`);
  }
}

/**
 * @param opts.client Anthropic SDK client
 * @param opts.source {Record<string, string>}  完整 canonical (dot-path → zh-TW)
 * @param opts.targetLang 'en' | 'ja'
 * @param opts.keysToTranslate {string[]}  只翻這些
 * @returns {Promise<Record<string, string>>}  已翻譯的 key → value
 */
export async function translateIncremental({
  client,
  source,
  targetLang,
  keysToTranslate,
}) {
  if (keysToTranslate.length === 0) return {};

  const prompt = buildPrompt({ source, targetLang, keysToTranslate });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return extractJson(text);
}
```

- [ ] **Step 4: 跑測試驗證通過**

```bash
pnpm run i18n:test
```

- [ ] **Step 5: Commit**

```bash
git add i18n/scripts/lib/translate.mjs i18n/scripts/lib/translate.test.mjs
git commit -m "feat(i18n): translate.mjs — Claude API 增量翻譯"
```

---

## Task 0.7: 實作 `sync.mjs` 主 CLI — 組裝全流程

**Files:**
- Create: `i18n/scripts/sync.mjs`

- [ ] **Step 1: 實作 sync.mjs**

寫 `i18n/scripts/sync.mjs`：
```js
#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

import { flattenDotPath, hashValue, diffCanonical } from './lib/diff.mjs';
import { buildArbKeyMap } from './lib/flatten.mjs';
import { buildArbJson } from './lib/transpile.mjs';
import { translateIncremental } from './lib/translate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

const CANONICAL = {
  'zh-TW': join(REPO_ROOT, 'i18n/canonical/zh-TW.json'),
  en: join(REPO_ROOT, 'i18n/canonical/en.json'),
  ja: join(REPO_ROOT, 'i18n/canonical/ja.json'),
};
const CACHE_PATH = join(REPO_ROOT, 'i18n/.i18n-cache.json');
const WEB_MESSAGES_DIR = join(REPO_ROOT, 'src/messages');
const MOBILE_L10N_DIR = join(REPO_ROOT, 'mobile/lib/l10n');

const TARGET_LANGS = ['en', 'ja'];

// ── CLI parsing ──
const args = process.argv.slice(2);
const isDry = args.includes('--dry');
const skipLlm = args.includes('--skip-llm');
const retranslateIdx = args.indexOf('--retranslate');
const retranslateKey = retranslateIdx >= 0 ? args[retranslateIdx + 1] : null;

// ── Helpers ──
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function unflattenDotPath(flat) {
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in cur)) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return out;
}

// ── Main ──
async function main() {
  console.log('📖 讀取 canonical...');
  const zhRaw = readJson(CANONICAL['zh-TW']);
  const zhFlat = flattenDotPath(zhRaw);
  const cache = existsSync(CACHE_PATH)
    ? readJson(CACHE_PATH)
    : { version: 1, hashes: {}, locked: {} };

  // 1. Diff
  const diff = diffCanonical(cache.hashes, zhFlat);
  console.log(`📊 Diff: +${diff.added.length} ~${diff.changed.length} -${diff.removed.length}`);
  if (diff.added.length) console.log('   新增:', diff.added.slice(0, 10));
  if (diff.changed.length) console.log('   變動:', diff.changed.slice(0, 10));
  if (diff.removed.length) console.log('   刪除:', diff.removed.slice(0, 10));

  let keysNeedingTranslation = [...diff.added, ...diff.changed];
  if (retranslateKey) {
    if (!(retranslateKey in zhFlat)) {
      throw new Error(`--retranslate key not found: ${retranslateKey}`);
    }
    keysNeedingTranslation.push(retranslateKey);
  }
  // 過濾掉 locked key
  keysNeedingTranslation = keysNeedingTranslation.filter(
    (k) => !cache.locked?.[k]
  );

  if (isDry) {
    console.log('💡 --dry 模式，檢查是否 in-sync...');
    // 簡單判斷：diff 有東西就算 out-of-sync
    const outOfSync = diff.added.length + diff.changed.length + diff.removed.length > 0;
    // 也檢查生成檔是否存在
    for (const lang of ['zh-TW', 'en', 'ja']) {
      const msgPath = join(WEB_MESSAGES_DIR, `${lang}.json`);
      if (!existsSync(msgPath)) {
        console.error(`❌ 生成檔缺少: ${msgPath}`);
        process.exit(1);
      }
    }
    if (outOfSync) {
      console.error('❌ canonical 與 cache 不同步，請跑 `pnpm run i18n:sync`');
      process.exit(1);
    }
    console.log('✅ In sync');
    return;
  }

  // 2. 讀舊的 en/ja（保留未 changed 的）
  const enFlat = flattenDotPath(readJson(CANONICAL.en));
  const jaFlat = flattenDotPath(readJson(CANONICAL.ja));

  // 刪除 removed key
  for (const k of diff.removed) {
    delete enFlat[k];
    delete jaFlat[k];
  }

  // 3. LLM 翻譯增量
  if (keysNeedingTranslation.length > 0 && !skipLlm) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    for (const lang of TARGET_LANGS) {
      console.log(`🌐 翻譯 → ${lang} (${keysNeedingTranslation.length} keys)...`);
      const translated = await translateIncremental({
        client,
        source: zhFlat,
        targetLang: lang,
        keysToTranslate: keysNeedingTranslation,
      });
      const target = lang === 'en' ? enFlat : jaFlat;
      Object.assign(target, translated);
    }
  } else if (skipLlm) {
    console.log('⏭️  --skip-llm，保留現有 en/ja');
  }

  // 4. 寫回 canonical en/ja（巢狀格式）
  writeJson(CANONICAL.en, unflattenDotPath(enFlat));
  writeJson(CANONICAL.ja, unflattenDotPath(jaFlat));

  // 5. Transpile → Web messages (next-intl 直接讀巢狀 JSON)
  writeJson(join(WEB_MESSAGES_DIR, 'zh-TW.json'), unflattenDotPath(zhFlat));
  writeJson(join(WEB_MESSAGES_DIR, 'en.json'), unflattenDotPath(enFlat));
  writeJson(join(WEB_MESSAGES_DIR, 'ja.json'), unflattenDotPath(jaFlat));
  console.log('📝 Wrote src/messages/*.json');

  // 6. Transpile → Mobile ARB
  const zhArb = buildArbJson(buildArbKeyMap(zhFlat), 'zh');
  const enArb = buildArbJson(buildArbKeyMap(enFlat), 'en');
  const jaArb = buildArbJson(buildArbKeyMap(jaFlat), 'ja');
  writeJson(join(MOBILE_L10N_DIR, 'app_zh.arb'), zhArb);
  writeJson(join(MOBILE_L10N_DIR, 'app_en.arb'), enArb);
  writeJson(join(MOBILE_L10N_DIR, 'app_ja.arb'), jaArb);
  console.log('📱 Wrote mobile/lib/l10n/*.arb');

  // 7. Update cache
  const newHashes = {};
  for (const [k, v] of Object.entries(zhFlat)) {
    newHashes[k] = hashValue(v);
  }
  cache.hashes = newHashes;
  writeJson(CACHE_PATH, cache);
  console.log('💾 Cache updated');

  console.log('✅ Sync 完成');
}

main().catch((err) => {
  console.error('❌', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
```

- [ ] **Step 2: 手動測試 dry run（canonical 空 + 生成檔還沒建）**

```bash
mkdir -p src/messages mobile/lib/l10n
echo '{}' > src/messages/zh-TW.json
echo '{}' > src/messages/en.json
echo '{}' > src/messages/ja.json
pnpm run i18n:sync --dry
```
Expected: `✅ In sync`（因為 canonical 是 `{}`，flat 是空，cache 也空，diff 無異動）

- [ ] **Step 3: 測試 `--skip-llm`（預期只轉檔不呼叫 API）**

```bash
pnpm run i18n:sync --skip-llm
```
Expected: 無錯、生成 src/messages 和 mobile/l10n 三份檔（空 ARB 應為 `{"@@locale":"zh"}`）

- [ ] **Step 4: 檢視生成結果**

```bash
cat i18n/.i18n-cache.json
cat mobile/lib/l10n/app_zh.arb
```

- [ ] **Step 5: Commit**

```bash
git add i18n/scripts/sync.mjs src/messages mobile/lib/l10n i18n/.i18n-cache.json
git commit -m "feat(i18n): sync.mjs 主 CLI + 初始空生成檔"
```

---

## Task 0.8: CI 整合 `i18n:check`

**Files:**
- Modify: `.github/workflows/ci.yml`（若有）或新增

- [ ] **Step 1: 檢查現有 CI config**

```bash
ls .github/workflows/ 2>/dev/null || echo "no github workflows"
```

- [ ] **Step 2: 視情況處理**

若有 CI config：在現有 lint/test job 加一步：
```yaml
- name: i18n sync check
  run: pnpm run i18n:check
```

若無 CI config：在 `i18n/README.md` 加一段 **CI Integration** 說明，列出所需 step，留待未來設 CI 時加入。

- [ ] **Step 3: 測試本地 `i18n:check` 指令**

```bash
pnpm run i18n:check
```
Expected: `✅ In sync`

- [ ] **Step 4: Commit（如有變動）**

```bash
git add .
git commit -m "chore(i18n): CI 整合 i18n:check" || echo "no changes"
```

---

# Phase 1 — Web next-intl 接線

## Task 1.1: 安裝 next-intl

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安裝**

```bash
pnpm add next-intl
```

- [ ] **Step 2: 確認版本**

```bash
grep next-intl package.json
```
Expected: `"next-intl": "^3.x.x"` 或更高

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(web): install next-intl"
```

---

## Task 1.2: 建立 `src/i18n/routing.ts` 和 `request.ts`

**Files:**
- Create: `src/i18n/routing.ts`
- Create: `src/i18n/request.ts`

- [ ] **Step 1: 寫 routing.ts**

寫 `src/i18n/routing.ts`：
```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['zh-TW', 'en', 'ja'] as const,
  defaultLocale: 'zh-TW',
  localePrefix: 'always', // 永遠有 /zh-TW, /en, /ja 前綴
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 2: 寫 request.ts**

寫 `src/i18n/request.ts`：
```ts
import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/
git commit -m "feat(web): next-intl routing + request config"
```

---

## Task 1.3: 建立 `src/middleware.ts`

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: 寫 middleware.ts**

寫 `src/middleware.ts`：
```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - /api, /_next, /_vercel
  // - files with an extension (e.g. favicon.ico)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(web): next-intl middleware — URL prefix locale routing"
```

---

## Task 1.4: `next.config.ts` 載入 next-intl plugin

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: 讀現有 config**

```bash
cat next.config.ts
```

- [ ] **Step 2: 加入 next-intl plugin**

修改 `next.config.ts`：
```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // ... 現有設定保留
};

export default withNextIntl(nextConfig);
```

（實作時要保留現有的所有 config 欄位，這裡只是 wrap export）

- [ ] **Step 3: 跑 dev server 驗證沒壞**

```bash
pnpm run dev
```
等看到 `✓ Ready` 後手動開 `http://localhost:3000/`，確認頁面還打得開（此時尚未搬 `[locale]`，middleware 會把所有路徑 redirect 到 `/zh-TW`，可能出 404，這是預期的 — 下一個 task 才會建 `[locale]` 目錄）。Ctrl+C 關掉。

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(web): 掛載 next-intl plugin"
```

---

## Task 1.5: 將 `src/app/(app)/*` 搬到 `src/app/[locale]/(app)/*`

**Files:**
- Move: `src/app/(app)/` → `src/app/[locale]/(app)/`
- Move: `src/app/login/` → `src/app/[locale]/login/`

**注意**：landing page `src/app/page.tsx` 和 `src/app/layout.tsx` **不動**（Landing page 不納入 i18n scope）。API routes `src/app/api/` **不動**。

- [ ] **Step 1: 使用 git mv 搬移**

```bash
mkdir -p "src/app/[locale]"
git mv "src/app/(app)" "src/app/[locale]/(app)"
git mv src/app/login "src/app/[locale]/login"
```

- [ ] **Step 2: 檢查 imports 是否仍正確**

```bash
git grep -l "from \"@/app/(app)" src/ 2>/dev/null
git grep -l "from \"@/app/login" src/ 2>/dev/null
```
Expected: 空（alias imports 用的是 `@/components`、`@/lib`，不應該跨 `@/app/...`）

若有，記下並修正。

- [ ] **Step 3: 檢查 Link / redirect 路徑寫死的**

```bash
git grep -n '"/login"' src/
git grep -n 'router.push("/' src/
git grep -n 'redirect("/' src/
```
記下所有結果，每個都要加 locale prefix 或改用 next-intl 的 `Link` / `useRouter`。**但這步驟在下個 task 處理**（避免這個 task 動太多）。

- [ ] **Step 4: Commit（純搬移，無邏輯改動）**

```bash
git add -A
git commit -m "refactor(web): 搬移 app routes 到 [locale] 目錄"
```

---

## Task 1.6: 建立 `src/app/[locale]/layout.tsx`

**Files:**
- Create: `src/app/[locale]/layout.tsx`
- Modify: `src/app/layout.tsx`（拆分）

目標：原本 root layout 的國際化邏輯（`<html lang>`、字型、主題）搬到 `[locale]/layout.tsx`，root layout 只留最 minimal 的 `<html><body>{children}</body></html>`（因為 Next.js 要求根 layout 必須存在）。

- [ ] **Step 1: 讀現有 root layout**

```bash
cat src/app/layout.tsx
```

- [ ] **Step 2: 建立新的 `src/app/[locale]/layout.tsx`**

寫 `src/app/[locale]/layout.tsx`：
```tsx
import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { routing, type Locale } from '@/i18n/routing';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Nudge',
  description: '輕量型每日任務推進工具',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();

  const cookieStore = await cookies();
  const resolvedFromCookie = cookieStore.get('nudge:theme-resolved')?.value;
  const initialResolvedTheme: 'light' | 'dark' =
    resolvedFromCookie === 'light' ? 'light' : 'dark';

  const paperFromCookie = cookieStore.get('nudge:paper-texture')?.value;
  const initialPaperTexture: 'on' | 'off' =
    paperFromCookie === 'off' ? 'off' : 'on';

  const htmlClass = [
    geistSans.variable,
    'h-full antialiased',
    initialResolvedTheme === 'dark' ? 'dark' : '',
    initialPaperTexture === 'on' ? 'paper-texture' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <html lang={locale} className={htmlClass}>
      <body className="min-h-full bg-background text-foreground font-sans">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            initialResolvedTheme={initialResolvedTheme}
            initialPaperTexture={initialPaperTexture}
          >
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 改 root `src/app/layout.tsx` 只剩 minimum**

寫 `src/app/layout.tsx`：
```tsx
// Next.js 要求有根 layout；實際的 html/body/theme 都在 [locale]/layout.tsx
// Landing page `/` 也會用這個，landing 不納入 i18n scope
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

**注意**：這個改動會讓 `/`（landing page）失去 `<html><body>` 包裝，**除非 landing page 自己有**。檢查：

```bash
cat src/app/page.tsx
```

若 landing page 沒有自己的 html 結構（大部分狀況），則需要為 landing 建立 `src/app/(landing)/layout.tsx`。先檢查後決定。若有 landing page 是獨立元件，建 `src/app/(landing)/layout.tsx` 搬 html 結構過來。

- [ ] **Step 4: 視 landing 狀況補 `(landing)` layout**

若 landing page 需要獨立 layout，建 `src/app/(landing)/layout.tsx`（內容就是原本 root layout 扣掉 i18n 的部分、寫死 `zh-TW`），並把 `src/app/page.tsx` 搬到 `src/app/(landing)/page.tsx`。

- [ ] **Step 5: 跑 dev server 驗證三語言 URL 都能打開**

```bash
pnpm run dev
```
開瀏覽器分別測：
- `http://localhost:3000/zh-TW` → redirect 到 login 或 app（認證邏輯不變）
- `http://localhost:3000/en` → 同上（內容仍是硬編碼中文，預期）
- `http://localhost:3000/ja` → 同上
- `http://localhost:3000/` → landing page（若有）

若失敗，debug 必然是：root layout 或 `[locale]` layout 的 html 結構有問題。

- [ ] **Step 6: 跑 build 驗證沒有型別錯**

```bash
pnpm run build
```
Expected: 成功完成

- [ ] **Step 7: Commit**

```bash
git add src/app/
git commit -m "feat(web): [locale] layout + NextIntlClientProvider"
```

---

## Task 1.7: 修正硬編碼的 `/login` 等路徑（加 locale prefix）

**Files:**
- Modify: 所有含 `"/login"`、`router.push("/...")`、`redirect("/...")` 的檔案

- [ ] **Step 1: 找出所有硬編碼路徑**

```bash
git grep -nE '"/login"|"/cards|"/notes|"/day' src/ | grep -v messages
git grep -nE 'router\.push\("/' src/
git grep -nE 'redirect\("/' src/
```

- [ ] **Step 2: 改用 next-intl 的 Link / useRouter**

對於 React components，改 import：
```ts
// 原本
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 改成
import { Link, useRouter } from '@/i18n/routing';
```

next-intl 會根據當前 locale 自動加前綴。

**建立 `src/i18n/routing.ts` 的 navigation helpers**（在 Task 1.2 已寫部分，現在補齊）：

更新 `src/i18n/routing.ts`：
```ts
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['zh-TW', 'en', 'ja'] as const,
  defaultLocale: 'zh-TW',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 3: 修所有找到的檔案**

逐一開啟、把原本 `next/link` / `next/navigation` 的 import 改成 `@/i18n/routing`。路徑字串本身**不用**加 `/en/` 之類的前綴 — next-intl wrapper 會自動處理。

例子：
```tsx
// before
import Link from 'next/link';
<Link href="/cards">Cards</Link>

// after
import { Link } from '@/i18n/routing';
<Link href="/cards">Cards</Link>
```

Server component 中：
```ts
// before
import { redirect } from 'next/navigation';
redirect('/login');

// after
import { redirect } from '@/i18n/routing';
redirect({ href: '/login', locale: 'zh-TW' }); // 或從 params 讀 locale
```

注意 server-side redirect 需要 locale 參數。在 `(app)/layout.tsx` auth 檢查那邊，要從 params 拿 locale。

- [ ] **Step 4: 修 `[locale]/(app)/layout.tsx` 的 auth redirect**

修改該檔：
```tsx
import { auth } from '@/lib/auth';
import { redirect } from '@/i18n/routing';
import { SidebarLayout } from '@/components/sidebar/sidebar-layout';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect({ href: '/login', locale });

  return <SidebarLayout>{children}</SidebarLayout>;
}
```

- [ ] **Step 5: 跑 build**

```bash
pnpm run build
```
Expected: 成功，沒有 type error

- [ ] **Step 6: 跑 dev 手動驗證**

```bash
pnpm run dev
```
測試：
- `/zh-TW` 未登入 → redirect 到 `/zh-TW/login`
- `/en` 未登入 → redirect 到 `/en/login`
- 登入後切換頁面 Link 點擊正確帶 locale

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(web): 改用 next-intl 的 Link/redirect，路徑自動帶 locale prefix"
```

---

## Task 1.8: 初始種幾個 canonical key，驗證 translation 流程

**Files:**
- Modify: `i18n/canonical/zh-TW.json`
- （sync script 會自動改 `en.json`、`ja.json`、messages、arb）

**前提**：環境變數 `ANTHROPIC_API_KEY` 已設。

- [ ] **Step 1: 加兩個測試 key**

寫 `i18n/canonical/zh-TW.json`：
```json
{
  "common": {
    "save": "儲存",
    "cancel": "取消"
  }
}
```

- [ ] **Step 2: 跑 sync（會呼叫 Claude API）**

```bash
pnpm run i18n:sync
```
Expected:
- Diff: +2 ~0 -0
- 對 en / ja 各翻 2 個 key
- 寫回 canonical/en.json、ja.json、src/messages/*、mobile/lib/l10n/*.arb

- [ ] **Step 3: 檢查輸出**

```bash
cat i18n/canonical/en.json
cat i18n/canonical/ja.json
cat mobile/lib/l10n/app_en.arb
```
Expected: 英日都有 `common.save`、`common.cancel` 翻譯結果，ARB 是 `commonSave` / `commonCancel` camelCase。

- [ ] **Step 4: 跑 `i18n:check` 驗證 in-sync**

```bash
pnpm run i18n:check
```
Expected: `✅ In sync`

- [ ] **Step 5: Commit**

```bash
git add i18n/ src/messages/ mobile/lib/l10n/
git commit -m "feat(i18n): 種子 key + 驗證 sync 全流程（common.save/cancel）"
```

---

# Phase 2 — Mobile gen-l10n 接線

## Task 2.1: 建立 `mobile/l10n.yaml`

**Files:**
- Create: `mobile/l10n.yaml`

- [ ] **Step 1: 寫 l10n.yaml**

寫 `mobile/l10n.yaml`：
```yaml
arb-dir: lib/l10n
template-arb-file: app_zh.arb
output-localization-file: app_localizations.dart
output-class: AppL10n
synthetic-package: false
output-dir: lib/l10n
preferred-supported-locales:
  - zh-TW
  - en
  - ja
```

- [ ] **Step 2: Commit**

```bash
git add mobile/l10n.yaml
git commit -m "feat(mobile): 加 l10n.yaml gen-l10n 設定"
```

---

## Task 2.2: 跑 `flutter gen-l10n` 生成 `AppL10n`

**Files:**
- Generated: `mobile/lib/l10n/app_localizations.dart`（+ 各語言 stub）

- [ ] **Step 1: 在 mobile 目錄跑 gen-l10n**

```bash
cd mobile && flutter gen-l10n && cd ..
```
Expected: 生成 `mobile/lib/l10n/app_localizations.dart` + `app_localizations_zh.dart` 等

- [ ] **Step 2: 確認生成檔存在**

```bash
ls mobile/lib/l10n/
```
Expected 看到 `app_localizations.dart`、`app_localizations_zh.dart`、`app_localizations_en.dart`、`app_localizations_ja.dart` 和三個 `.arb`

- [ ] **Step 3: 驗證生成的 class 有 `commonSave`、`commonCancel` getter**

```bash
grep -n "commonSave\|commonCancel" mobile/lib/l10n/app_localizations.dart
```
Expected: 看到 getter 定義

- [ ] **Step 4: Flutter analyze**

```bash
cd mobile && flutter analyze lib/l10n/ && cd ..
```
Expected: No issues found

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/l10n/
git commit -m "feat(mobile): gen-l10n 生成 AppL10n class"
```

---

## Task 2.3: 建立 `locale_provider.dart` Riverpod notifier（TDD）

**Files:**
- Create: `mobile/lib/core/locale_provider.dart`
- Test: `mobile/test/core/locale_provider_test.dart`

- [ ] **Step 1: 寫失敗測試**

寫 `mobile/test/core/locale_provider_test.dart`：
```dart
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nudge/core/locale_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('build returns null initially (system locale)', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    expect(container.read(localeProvider), isNull);
  });

  test('setLocale writes to SharedPreferences', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(localeProvider.notifier).setLocale(const Locale('en'));
    expect(container.read(localeProvider), const Locale('en'));

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('nudge:locale'), 'en');
  });

  test('clearLocale removes preference (back to system)', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(localeProvider.notifier).setLocale(const Locale('en'));
    await container.read(localeProvider.notifier).clearLocale();
    expect(container.read(localeProvider), isNull);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('nudge:locale'), isNull);
  });

  test('loads persisted locale on build', () async {
    SharedPreferences.setMockInitialValues({'nudge:locale': 'ja'});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    // 等 _load() async 完成 — 讀完會觸發 state update
    await Future.delayed(Duration.zero);
    expect(container.read(localeProvider), const Locale('ja'));
  });
}
```

- [ ] **Step 2: 跑測試驗證失敗**

```bash
cd mobile && flutter test test/core/locale_provider_test.dart && cd ..
```
Expected: fail（檔案不存在）

- [ ] **Step 3: 實作 `locale_provider.dart`**

寫 `mobile/lib/core/locale_provider.dart`：
```dart
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _storageKey = 'nudge:locale';
const supportedLocaleTags = ['zh-TW', 'en', 'ja'];

/// BCP47 tag → Flutter Locale
Locale parseLocaleTag(String tag) {
  final parts = tag.split('-');
  if (parts.length == 1) return Locale(parts[0]);
  return Locale(parts[0], parts[1]);
}

/// Flutter Locale → BCP47 tag（例 'zh-TW'、'en'、'ja'）
String formatLocaleTag(Locale locale) {
  if (locale.countryCode != null && locale.countryCode!.isNotEmpty) {
    return '${locale.languageCode}-${locale.countryCode}';
  }
  return locale.languageCode;
}

/// 從 Flutter locale 映射到 intl / DateFormat 可接受的 tag（`zh_TW`、`en_US`、`ja_JP`）
String intlLocaleTag(Locale? locale) {
  if (locale == null) return 'zh_TW';
  if (locale.languageCode == 'zh') return 'zh_TW';
  if (locale.languageCode == 'en') return 'en_US';
  if (locale.languageCode == 'ja') return 'ja_JP';
  return 'zh_TW';
}

/// null = 跟隨系統；Locale = 使用者覆蓋
final localeProvider =
    NotifierProvider<LocaleNotifier, Locale?>(LocaleNotifier.new);

class LocaleNotifier extends Notifier<Locale?> {
  @override
  Locale? build() {
    _load();
    return null;
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_storageKey);
    if (stored != null && supportedLocaleTags.contains(stored)) {
      state = parseLocaleTag(stored);
    }
  }

  Future<void> setLocale(Locale locale) async {
    state = locale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_storageKey, formatLocaleTag(locale));
  }

  Future<void> clearLocale() async {
    state = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
  }
}
```

- [ ] **Step 4: 跑測試驗證通過**

```bash
cd mobile && flutter test test/core/locale_provider_test.dart && cd ..
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/core/locale_provider.dart mobile/test/core/locale_provider_test.dart
git commit -m "feat(mobile): localeProvider + SharedPreferences 持久化"
```

---

## Task 2.4: MaterialApp 接線 AppL10n delegates + localeProvider

**Files:**
- Modify: `mobile/lib/app.dart`

- [ ] **Step 1: 讀現有 app.dart**

```bash
cat mobile/lib/app.dart
```

- [ ] **Step 2: 修改 MaterialApp 區塊**

在 `app.dart` 的 `NudgeApp.build()` 方法修改 `MaterialApp.router`：

```dart
// 新增 import
import 'core/locale_provider.dart';
import 'l10n/app_localizations.dart';

// ...

@override
Widget build(BuildContext context, WidgetRef ref) {
  final router = ref.watch(routerProvider);
  final themeMode = ref.watch(themeProvider);
  final brightness = resolveThemeBrightness(themeMode);
  final userLocale = ref.watch(localeProvider);

  AppColors.setDark(brightness == Brightness.dark);

  return MaterialApp.router(
    title: 'Nudge',
    debugShowCheckedModeBanner: false,
    theme: AppColors.buildThemeData(brightness),
    locale: userLocale,  // null = 跟隨系統
    localizationsDelegates: const [
      AppL10n.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
      FlutterQuillLocalizations.delegate,
    ],
    supportedLocales: const [
      Locale('zh', 'TW'),
      Locale('en'),
      Locale('ja'),
    ],
    routerConfig: router,
  );
}
```

- [ ] **Step 3: Flutter analyze**

```bash
cd mobile && flutter analyze lib/app.dart && cd ..
```
Expected: No issues found

- [ ] **Step 4: 跑 app 驗證啟動沒崩**

```bash
cd mobile && flutter run -d CEB11490-5C95-4528-9125-B0BB7E02DC0D 2>&1 | head -30
```
（背景跑 30 秒後手動確認 app 能啟動）。Ctrl+C 關掉。

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/app.dart
git commit -m "feat(mobile): MaterialApp 掛載 AppL10n delegates + localeProvider"
```

---

## Task 2.5: 在一個隨便的畫面用 AppL10n 驗證通路

**Files:**
- Modify: `mobile/lib/features/settings/settings_screen.dart`（暫時驗證用）

- [ ] **Step 1: 在設定頁某個地方用 `commonSave`**

找到設定頁的標題或某個 label，暫時改成用 AppL10n（只當驗證，之後 Phase 4 會正式遷移）：

在 `settings_screen.dart` 頂部 import：
```dart
import '../../l10n/app_localizations.dart';
```

在 build 方法裡找個地方加一行（例如頁面最底部 debug 用）：
```dart
Text('test: ${AppL10n.of(context)!.commonSave}'),
```

- [ ] **Step 2: Flutter analyze**

```bash
cd mobile && flutter analyze lib/features/settings/settings_screen.dart && cd ..
```

- [ ] **Step 3: 跑 app 切到設定頁，確認看到「儲存」**

```bash
cd mobile && flutter run -d CEB11490-5C95-4528-9125-B0BB7E02DC0D 2>&1 &
```
用 simulator 切到設定頁、確認畫面出現「test: 儲存」。

- [ ] **Step 4: 移除 debug 文字**

把剛才加的 test Text 刪掉。

- [ ] **Step 5: Commit 移除的動作（避免留下 debug 程式碼）**

```bash
git add mobile/lib/features/settings/settings_screen.dart
git commit -m "chore(mobile): 清掉 AppL10n 驗證用的 debug 文字" || echo "no changes"
```

---

# Phase 3 — DB schema + User locale persistence

## Task 3.1: Drizzle schema 加 `users.locale`

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/NNNN_add_users_locale.sql`

- [ ] **Step 1: 修改 schema.ts**

修改 `src/lib/db/schema.ts` 的 `users` 表定義：
```ts
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  locale: text("locale"), // nullable; null = 未設定，讀系統語言
  createdAt: text("created_at").notNull(),
});
```

- [ ] **Step 2: 產生 migration**

```bash
pnpm drizzle-kit generate
```
Expected: `drizzle/` 目錄新增一個 SQL 檔

- [ ] **Step 3: 檢視 migration SQL 正確**

```bash
ls -t drizzle/*.sql | head -1
cat $(ls -t drizzle/*.sql | head -1)
```
Expected: `ALTER TABLE "users" ADD COLUMN "locale" text;`

- [ ] **Step 4: 套用到本地 DB（若有本地 DB）**

```bash
pnpm drizzle-kit migrate
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(db): users 加 locale 欄位"
```

---

## Task 3.2: `GET /api/me` 回傳 locale

**Files:**
- Modify: `src/app/api/me/route.ts`

- [ ] **Step 1: 讀現有檔**

```bash
cat src/app/api/me/route.ts
```

- [ ] **Step 2: 修改回傳 shape 加 locale**

找到 SELECT 區塊或 response 建構處，把 `locale` 納入。例如：
```ts
// 原本類似
const user = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
return NextResponse.json({
  id: user[0].id,
  email: user[0].email,
  // ...
});

// 改成（加 locale）
return NextResponse.json({
  id: user[0].id,
  email: user[0].email,
  // ...其他欄位
  locale: user[0].locale, // null 表示未設定
});
```

- [ ] **Step 3: 跑 build**

```bash
pnpm run build
```
Expected: 成功

- [ ] **Step 4: 手動測試（若有登入 session）**

```bash
pnpm run dev
```
開瀏覽器 devtools 打 `/api/me`，檢查 response 有 `locale` 欄位（值可能是 `null`）

- [ ] **Step 5: Commit**

```bash
git add src/app/api/me/route.ts
git commit -m "feat(api): GET /api/me 回傳 locale"
```

---

## Task 3.3: `PATCH /api/me/locale` 新 endpoint

**Files:**
- Create: `src/app/api/me/locale/route.ts`

- [ ] **Step 1: 建立 endpoint**

寫 `src/app/api/me/locale/route.ts`：
```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/get-user";

const SUPPORTED = ['zh-TW', 'en', 'ja'] as const;
type SupportedLocale = typeof SUPPORTED[number];

function isSupported(v: unknown): v is SupportedLocale {
  return typeof v === 'string' && (SUPPORTED as readonly string[]).includes(v);
}

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locale = (body as Record<string, unknown>)?.locale;
  // null 允許（表示清除偏好、跟隨系統）
  if (locale !== null && !isSupported(locale)) {
    return NextResponse.json(
      { error: "Unsupported locale", supported: SUPPORTED },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({ locale: locale as string | null })
    .where(eq(users.id, user.id));

  return NextResponse.json({ locale });
}
```

- [ ] **Step 2: 跑 build**

```bash
pnpm run build
```

- [ ] **Step 3: 手動測試**

```bash
pnpm run dev
```
用 curl（假設已登入、有 session cookie）：
```bash
curl -X PATCH http://localhost:3000/api/me/locale \
  -H "Content-Type: application/json" \
  -d '{"locale":"en"}' \
  -b "cookie string"
```
Expected: `{"locale":"en"}`

然後 `GET /api/me` 應該看到 `locale: "en"`。

**驗證失敗情境**：
```bash
curl -X PATCH http://localhost:3000/api/me/locale -H "Content-Type: application/json" -d '{"locale":"xx"}'
# Expected: 400 Unsupported locale
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/me/locale/route.ts
git commit -m "feat(api): PATCH /api/me/locale 更新使用者語言偏好"
```

---

## Task 3.4: Web middleware 讀 user.locale 做 redirect

**Files:**
- Modify: `src/middleware.ts`

**背景**：next-intl middleware 預設會用 `accept-language` header 決定 locale。現在要加一層：若已登入，優先用 `users.locale`。但 middleware 無法直接查 DB（Edge runtime 限制），所以策略是：**登入時 API 把 `user.locale` 寫到 cookie**，middleware 讀 cookie。

- [ ] **Step 1: 找 login/auth callback，登入成功時寫 locale cookie**

找現有 auth 流程，通常在 `src/lib/auth.ts` 或 NextAuth config 的 `callbacks`：

```bash
cat src/lib/auth.ts
```

在 session callback 或 signIn callback 把 user.locale 寫到 cookie 是非 trivial 的 — NextAuth 的 callbacks 沒直接拿 response headers。**改用另一個簡單策略**：

**策略：登入 / `/api/me` 讀到 user 時，用 `Set-Cookie` 寫入 `NEXT_LOCALE` cookie**（next-intl 預設讀的 cookie 名稱）。

修改 `src/app/api/me/route.ts`：
```ts
import { cookies } from 'next/headers';

export async function GET() {
  // ... 現有邏輯
  const cookieStore = await cookies();
  if (user[0].locale) {
    cookieStore.set('NEXT_LOCALE', user[0].locale, {
      httpOnly: false,  // middleware 要讀
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return NextResponse.json({ ... });
}
```

修改 `src/app/api/me/locale/route.ts` 的 PATCH handler，更新 cookie：
```ts
import { cookies } from 'next/headers';

// 在 db.update 之後
const cookieStore = await cookies();
if (locale === null) {
  cookieStore.delete('NEXT_LOCALE');
} else {
  cookieStore.set('NEXT_LOCALE', locale as string, {
    httpOnly: false,
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
}
```

- [ ] **Step 2: middleware 行為確認**

next-intl middleware 預設會讀 `NEXT_LOCALE` cookie 作為 locale 決定依據之一。實際上只要 cookie 寫對、middleware 就會自動處理。無需改 `src/middleware.ts`。

- [ ] **Step 3: 跑 build**

```bash
pnpm run build
```

- [ ] **Step 4: 手動驗證**

```bash
pnpm run dev
```
1. 登入
2. PATCH `/api/me/locale` 設成 `en`
3. 重整網頁 → 應該 redirect 到 `/en/...`
4. 清 cookie → 重整應該回到 `accept-language` 決定的 locale

- [ ] **Step 5: Commit**

```bash
git add src/app/api/me/
git commit -m "feat(web): user.locale 寫入 NEXT_LOCALE cookie，middleware 自動 redirect"
```

---

## Task 3.5: Mobile 登入後 sync server locale

**Files:**
- Modify: `mobile/lib/features/auth/auth_provider.dart`

**背景**：mobile 的 `AuthNotifier` 已經在登入/初始化時呼叫 `/api/me` 拿 user 資料。現在拿到 `user.locale` 後要同步到 `localeProvider`。

- [ ] **Step 1: 讀現有 auth provider**

```bash
cat mobile/lib/features/auth/auth_provider.dart
```

找到呼叫 `/api/me` 或 setUser 的位置。

- [ ] **Step 2: 注入 localeProvider 並同步**

在 `auth_provider.dart` 加 logic：拿到 `user['locale']` 後呼叫 `ref.read(localeProvider.notifier).setLocale(...)`（若與本地不同）。

`parseLocaleTag` / `formatLocaleTag` / `supportedLocaleTags` 已在 Task 2.3 的 `locale_provider.dart` 定義成 top-level，直接 import 使用即可：

```dart
// 原本在登入成功或初始化時（設 AuthState 之後）
import '../../core/locale_provider.dart';

// ... 在 fetchMe 成功處（設完 state = AuthState(...) 之後）
final serverTag = response.data['locale'] as String?;
if (serverTag != null && supportedLocaleTags.contains(serverTag)) {
  final current = ref.read(localeProvider);
  final currentTag = current == null ? null : formatLocaleTag(current);
  if (currentTag != serverTag) {
    await ref
        .read(localeProvider.notifier)
        .setLocale(parseLocaleTag(serverTag));
  }
}
```

- [ ] **Step 3: Flutter analyze**

```bash
cd mobile && flutter analyze lib/features/auth/auth_provider.dart lib/core/locale_provider.dart && cd ..
```

- [ ] **Step 4: 跑 locale_provider test 確認沒被改壞**

```bash
cd mobile && flutter test test/core/locale_provider_test.dart && cd ..
```

- [ ] **Step 5: 手動驗證跨裝置同步**

假設本地 SharedPreferences 未設 locale，透過 web 設 `user.locale = 'en'`，再啟 mobile 登入 → app 語言應切成 en（預期是看到系統 MaterialLocalizations 變成英文，因為 commonSave / commonCancel 尚未用在實際畫面）。若還沒明顯可見，在設定頁暫時印 `AppL10n.of(context)!.commonSave` 驗證。

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/features/auth/auth_provider.dart mobile/lib/core/locale_provider.dart
git commit -m "feat(mobile): 登入後從 server 同步 user.locale"
```

---

## Task 3.6: 最終整合驗證（不寫 code，純手動 QA）

不需要 code 變動，但要走過完整 flow 確認 foundation 可用。

- [ ] **Step 1: Canonical sync flow**

```bash
# 加第三個 key
```
改 `i18n/canonical/zh-TW.json`：
```json
{
  "common": {
    "save": "儲存",
    "cancel": "取消",
    "delete": "刪除"
  }
}
```

```bash
pnpm run i18n:sync
pnpm run i18n:check
```
Expected: 成功 + In sync

```bash
git status
```
Expected: 看到 canonical/en.json、ja.json、src/messages/*、mobile/lib/l10n/*.arb、cache 變動

- [ ] **Step 2: Web 三語言 URL**

```bash
pnpm run dev
```
測：
- `http://localhost:3000/zh-TW/cards` ✓
- `http://localhost:3000/en/cards` ✓
- `http://localhost:3000/ja/cards` ✓
- `http://localhost:3000/zh-TW/settings` → 登入後可用
- 切 PATCH /api/me/locale 到 en → 重整 `/zh-TW/cards` → 應該 redirect `/en/cards`

- [ ] **Step 3: Mobile 語言切換**

```bash
cd mobile && flutter run -d CEB11490-5C95-4528-9125-B0BB7E02DC0D
```
（暫時需要手動在某個地方呼叫 `ref.read(localeProvider.notifier).setLocale(Locale('en'))` 測試，因為 Phase 4 才會加設定頁 UI）

在設定頁 debug 暫時加：
```dart
ElevatedButton(
  onPressed: () => ref.read(localeProvider.notifier).setLocale(Locale('en')),
  child: Text('Test: EN'),
),
ElevatedButton(
  onPressed: () => ref.read(localeProvider.notifier).setLocale(Locale('zh', 'TW')),
  child: Text('Test: ZH-TW'),
),
ElevatedButton(
  onPressed: () => ref.read(localeProvider.notifier).clearLocale(),
  child: Text('Test: System'),
),
```

點按鈕切換，確認 MaterialLocalizations 系統文字（date picker 的「確定/取消」、時間選擇器）有跟著切換（這是最容易看到的 i18n 生效徵兆）。

- [ ] **Step 4: 移除 debug 按鈕**

把 Step 3 加的三個按鈕刪掉。

- [ ] **Step 5: 再跑一次 flutter analyze 和 next build**

```bash
cd mobile && flutter analyze && cd ..
pnpm run build
```

- [ ] **Step 6: Commit（清理）**

```bash
git add -A
git commit -m "chore: Phase 0-3 整合驗證 — 清理 debug" || echo "nothing to clean"
```

---

## 完成條件

執行完整 plan 後，應具備以下能力（但尚未遷移任何 feature）：

- ✅ `i18n/canonical/zh-TW.json` 是 source of truth
- ✅ `pnpm run i18n:sync` 可以：diff、呼叫 Claude API 增量翻譯 en/ja、產出 Web messages 和 Mobile ARB
- ✅ `pnpm run i18n:check --dry` 可在 CI 驗證同步
- ✅ Web 可透過 `/zh-TW/*`、`/en/*`、`/ja/*` URL 訪問（內容仍為硬編碼中文）
- ✅ Web middleware 會讀 `NEXT_LOCALE` cookie redirect
- ✅ `GET /api/me` 回傳 `locale` 欄位
- ✅ `PATCH /api/me/locale` 可更新使用者偏好 + 寫 cookie
- ✅ DB `users.locale` 欄位存在
- ✅ Mobile `AppL10n.of(context)` 可用（至少拿得到 `commonSave` 等測試 key）
- ✅ Mobile `localeProvider` Riverpod 可切換語言 + 持久化 SharedPreferences
- ✅ Mobile 登入後同步 server `user.locale`

## 下一步（另寫 plan）

- **Phase 4 plan** — Settings 頁遷移 + 設定頁語言切換 UI（第一個 feature dogfooding）
- **Phase 5-7 plan** — Tasks / Cards / Notes 各自獨立 plan
- **Phase 8 plan** — Semantic constants + 日期/數字
- **Phase 9 plan** — 推播 i18n helper
- **Phase 10 plan** — Lint 防回歸
