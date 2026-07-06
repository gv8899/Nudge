# Onboarding — 早上測試清單

分支 `worktree-feat+onboarding-flow`。Build / 單元測試 / xcodebuild(iOS+macOS) 都過了，
但**互動流程我沒法親自跑**，以下請你代測。

## ⚠️ 步驟 0（必做，否則 app 會壞）：先跑 migration

新 code 會 SELECT `users.onboarded_at`，欄位不存在 `/api/me` 會報錯。

```bash
psql "$DATABASE_URL" -f drizzle/0009_add_users_onboarded_at.sql
```

注意：**dev / prod 共用同一個 Postgres**。這支是 additive nullable + 把既有用戶
`onboarded_at` 設成 epoch(1970)（標記「已 onboard、不 seed、也不跳 welcome」）。
對還在跑的舊 code 無害。跑之前確認你認得這個 DB。

## 步驟 1：Web first-run（要用「全新帳號」）

Seed 只對**全新帳號**觸發。你現有的帳號跑完 migration 後 = 已 onboard，不會 seed。
→ 用一個**沒登入過的 Google 帳號**測，或先 `DELETE /api/me` 刪掉某測試帳號再重登
（會 cascade 刪那帳號所有資料，別拿你的主帳號）。

`npm run dev` → 用新帳號登入，預期：
- [ ] 落在今日，清單已有 seed 的一天：早晨運動(已完成)、寫週報(每週+17:00 提醒)、
      準備簡報、閱讀 1 章、晨間站會(工作日重複)，逾期區有 繳水電費 / 回覆客戶 Email
- [ ] 頂部出現 **welcome 卡**（歡迎 + 任務/卡片/重複三點 + 開始使用 + 看看範例卡片）
- [ ] 「準備簡報」上方有 inline 提示「點左邊的圈圈…」；「寫週報」上方有「這個會自動重複…」
- [ ] 點「開始使用」→ welcome 卡消失；**reload 後不再出現**（localStorage 已讀）
- [ ] 各 inline 提示的「知道了」可個別關；reload 不再出現
- [ ] 「看看範例卡片」→ 到 /cards，看到 4 張 seed 卡片（Q2 OKR / 跑步筆記 / 減法 / 京都）
- [ ] 完成一個範例任務正常勾選
- [ ] 切語言（en / ja）→ 範例內容語言依帳號建立時的請求 locale；UI 文案跟著介面語言

## 步驟 2：iOS / macOS first-run（模擬器）

⚠️ Sign in with Apple 不能在 sim CLI build 測（entitlement 被剝）；用能跑的登入方式，
或參考 feedback_sign_in_with_apple 的限制。

- [ ] 全新帳號首登 → 落在 Today（有 seed 資料）→ **welcome overlay** 蓋在清單上
- [ ] `onboardedAt` 有到 client（靠 `DailyHostView` 出現時呼叫 `refreshCurrentUser()`
      打 /api/me；login response 不帶這欄）——若 overlay 沒出現，先查這條
- [ ] 開始使用 → 關閉；重開 app 不再出現（UserDefaults）
- [ ] 看看範例卡片：**macOS** 會切到 Cards 分頁；**iOS 目前只關閉**（iOS TabView 沒接
      switchTab，想要 iOS 也跳 Cards 要另接 notificationRouter）
- [ ] backdrop 點擊 / mac ⎋ 可關
- [ ] 舊帳號（onboardedAt 為 epoch/null）→ 不出現 overlay

## 已知取捨 / 待確認

- **iOS/macOS inline 提示沒做**：TaskListView 的 Item identity 有歷史地雷
      （勾選後 checkmark 消失那條），subagent 依授權只出 welcome overlay，提示文案
      已進 xcstrings，要補時 copy-ready。web 有 inline 提示、Apple 只有 overlay。
- **en/ja 範例內容 + 部分 UI 文案是我初翻**：
  - 範例內容：`src/lib/onboarding/content/{en,ja}.ts`（檔頭有 `TODO(review)`）
  - UI 文案：`i18n/canonical/{en,ja}.json` 的 `onboarding.*`
  請 review 用詞。
- **macOS overlay 範圍**：scoped 在 DailyHostView host（暗化任務欄），非整個視窗級。
- **時區**：seed「今天」用 Asia/Taipei 預設（帳號建立當下不知使用者時區）。
- Flutter `mobile/` 已退役，`i18n:sync` 仍會寫 arb 但被 gitignore，忽略即可。
