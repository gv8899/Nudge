# Nudge i18n Tooling

Single source of truth for all UI strings across Web and Mobile.

## 結構

- `canonical/zh-TW.json` — 手改 source（巢狀 JSON + ICU MessageFormat）
- `canonical/en.json` / `canonical/ja.json` — LLM 生成，人工 review
- `.i18n-cache.json` — hash 記錄和 lock 清單
- `scripts/sync.mjs` — 主腳本
- `scripts/lib/` — 子模組

## Workflow（對話式翻譯）

翻譯工作流程設計成跟 Claude Code 對話互動，**不需要 API key**。

1. 改 `canonical/zh-TW.json`（新增/修改/刪除 key）
2. 跑 `npm run i18n:sync`
3. 若有新/變動 key，script 會產生 `i18n/.pending-translations.md` 列出待翻譯項目
4. **在 Claude Code 對話裡請 Claude 幫忙翻譯**：
   > 「幫我處理 i18n 的 pending 翻譯」
   
   Claude 會讀 `.pending-translations.md` + `canonical/zh-TW.json`，直接編輯 `canonical/en.json` 和 `canonical/ja.json`，保留既有翻譯風格。
5. 再跑 `npm run i18n:sync` — pending 檔會自動刪掉、轉檔到 Web (`src/messages/*.json`) 和 Mobile (`mobile/lib/l10n/*.arb`)
6. `git diff` 檢視生成檔、有不滿意的直接手改 `canonical/en.json` / `ja.json` 再跑一次 sync
7. 若不希望某個 key 被提示重翻，在 `.i18n-cache.json` `locked` 加入該 key
8. Commit canonical + 生成檔

### 為什麼不用 API

原本設計用 `@anthropic-ai/sdk` 直接呼叫 Claude API 做翻譯，但：
- 你已經訂閱 Claude Code，沒理由再開 API 額度
- 對話式翻譯可以立即 review、當場微調
- 對話裡 Claude 看得到 plan / feedback memory，翻譯風格更一致

唯一缺點：CI 沒法自動翻譯。Phase 0 本來也不需要 CI 翻譯，`npm run i18n:check` 只做 dry diff 驗證同步狀態。

## CLI

- `npm run i18n:sync` — 跑 diff、產 pending、轉檔
- `npm run i18n:check` — `--dry`，只檢查同步狀態（CI 用，有 pending 或 diff 會 exit 1）
- `npm run i18n:test` — vitest 跑 `i18n/scripts/` 的單元測試

## Fallback 策略

若 en/ja canonical 缺 key，轉檔時會用 zh-TW 值當 fallback 填到生成的 `src/messages/en.json` 和 `mobile/lib/l10n/app_en.arb`，確保 next-intl 和 Flutter gen-l10n 不會因為缺 key 而壞掉。這個 fallback 只存在於生成檔，canonical 仍然保持乾淨（user 翻哪些就是哪些）。

## CI Integration

專案目前尚無 `.github/workflows/`。未來設 CI 時，加入以下 step 檢查 canonical 與生成檔是否同步：

```yaml
- name: i18n sync check
  run: npm run i18n:check
```

此指令只做 diff 檢查、不呼叫 LLM、不寫檔。若 canonical 有變動但生成檔沒跟上，會 exit 1 並要求開發者在本地跑 `npm run i18n:sync`。
