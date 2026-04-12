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
2. 跑 `npm run i18n:sync`
3. Script 偵測 diff → 呼叫 Claude API 翻譯增量 → 寫回 en/ja
4. Script 轉檔到 Web (`src/messages/*.json`) 和 Mobile (`mobile/lib/l10n/*.arb`)
5. `git diff` 檢視翻譯結果、修 en/ja 中不滿意的文案
6. 若不希望某個 key 被自動覆蓋，在 `.i18n-cache.json` `locked` 加入該 key
7. Commit canonical + 生成檔

## CLI

- `npm run i18n:sync` — 全流程
- `npm run i18n:check` — `--dry`，只 diff 不改檔（CI 用）
- `npm run i18n:sync -- --skip-llm` — 不呼叫 LLM，只轉檔
- `npm run i18n:sync -- --retranslate <key>` — 強制重翻某 key
- `npm run i18n:test` — vitest 跑 `i18n/scripts/` 的單元測試

## CI Integration

專案目前尚無 `.github/workflows/`。未來設 CI 時，加入以下 step 檢查 canonical 與生成檔是否同步：

```yaml
- name: i18n sync check
  run: npm run i18n:check
```

此指令只做 diff 檢查、不呼叫 LLM、不寫檔。若 canonical 有變動但生成檔沒跟上，會 exit 1 並要求開發者在本地跑 `npm run i18n:sync`。
