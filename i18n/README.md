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
