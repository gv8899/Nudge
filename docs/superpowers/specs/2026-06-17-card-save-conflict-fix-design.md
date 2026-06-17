# 卡片描述/標題存檔 跨裝置覆蓋 修法設計

**Goal:** 修掉「停在舊內容的裝置一動就覆蓋別台新編輯」的資料遺失 bug。

**根因（已實證）:**
1. 編輯器載入後不再同步 server（防游標跳）→ 久開的編輯器手上是過時內容。
2. 存檔走 `PATCH /api/tasks/[id]`，`db.update().set({updatedAt:now, ...})` —— **last-write-wins、零版本檢查**。
3. 「離開就 flush」（onDisappear / 失焦 / 切分頁 / debounce）**沒判斷內容是否真的改過** → 沒編輯的裝置也把舊內容 PUT 回去。

**修法:** dirty 判斷（沒改不存）+ 樂觀並行控制（`baseUpdatedAt` 版本檢查、衝突拒覆蓋）。衝突時 client 靜默改用最新版。

---

## 1. 範圍

| 平台 | 是否納入 | 原因 |
|---|---|---|
| **Server**（`/api/tasks/[id]` PATCH） | ✅ | 所有 title/description 存檔的單一改點 |
| **Mac + iOS**（共用 NudgeUI 編輯器） | ✅ | 這次事件的當事雙方 |
| **Web**（React/TipTap card-detail / task-detail-modal） | ✅ | 也會編輯描述、也是潛在覆蓋源 |
| **Flutter mobile** | ❌ | 不編輯描述（只有 l10n、無 PATCH /api/tasks） |

**守的欄位:** `title` + `description`（rich-edit 欄位）。
**不守:** sortOrder / remindAt / 勾完成等操作型欄位（走 daily/assignment 那套，不該被衝突擋）。

---

## 2. Server — 樂觀並行檢查（`PATCH /api/tasks/[id]`）

- body 多收**選填** `baseUpdatedAt`（client 這次編輯所基於的 task.updatedAt）。
- endpoint 本來就已先 `select existing`（ownership 檢查），加檢查零額外查詢:
  ```
  若 (body.baseUpdatedAt 有給)
     且 (body.title !== undefined || body.description !== undefined)   // 只守 rich-edit
     且 (existing.updatedAt > body.baseUpdatedAt)                      // server 已更新
  → 回 409 Conflict，body = 目前 server 最新 task（含 tags 結構，與 GET 一致）
  ```
- `baseUpdatedAt` 沒給 → **跳過檢查**（向後相容:舊 client / Flutter / 操作型 PATCH 不受影響，可逐平台上線）。
- 正常寫入後一樣回 `updated`（含新 updatedAt，client 拿去更新 base）。

---

## 3. Client — dirty 判斷（沒改不存）

- 編輯器持有 **`lastSavedDescription` / `lastSavedTitle`**（init = 載入內容；每次成功存檔後更新）。
- 所有存檔點（debounce / onDisappear / 失焦 onBlurSave / flushEditors / commandBus.flush）**存前先比對**:當前內容 == lastSaved → **不送**。
- **→ 直接根治本次事件**:Mac 沒改那張卡，dirty=false，flush 不送 → 不覆蓋。

---

## 4. Client — 送版本 + 409 處理（衝突靜默用最新）

- 編輯器持有 **`baseUpdatedAt`**（init = 載入卡片的 updatedAt；每次成功存檔後 ← 回應的新 updatedAt）。
- 存檔時把 `baseUpdatedAt` 帶進 PATCH。
- **成功**:更新 `baseUpdatedAt` + `lastSaved*` 為回應值。
- **409**:取回應裡 server 最新 task →
  - 把編輯器內容**重載成 server 版**（local 這次未存編輯**丟棄**，方案 2）。
  - 更新 `baseUpdatedAt` / `lastSaved*` 為 server 版。
  - 重載編輯器:給 RichTextEditor 新的 `.id`（強制重生、載入新內容），與切換卡片同模式。

---

## 5. 各平台落點

- **Server**: `src/app/api/tasks/[id]/route.ts` PATCH 加 baseUpdatedAt 檢查 + 409。
- **Mac/iOS（NudgeCore + NudgeUI）**:
  - `APIClient` patch 支援帶 body 的 409 偵測 → 丟可辨識的 `APIError.conflict(latest)`。
  - `TaskRepository.updateDescription/updateTitle`、`CardRepository.updateTitle/updateDescription`:帶 baseUpdatedAt、回傳新 updatedAt / 衝突最新值。
  - `CardDetailView` / `DashboardColumnCardDetail`:dirty 比對 + baseUpdatedAt 狀態 + 409 重載編輯器（換 `.id`）。
- **Web**: card-detail / task-detail-modal 的存檔 hook:dirty 比對 + baseUpdatedAt + 409 重載。

---

## 6. 邊界 / 細節

| 情況 | 行為 |
|---|---|
| 舊 client / Flutter（不送 baseUpdatedAt） | server 跳過檢查（向後相容） |
| 同一 client 連續存（debounce 多次） | 每次成功後更新 baseUpdatedAt，避免自己 409 自己 |
| 內容沒改 | dirty=false → 不送（不觸發 409、不覆蓋） |
| 操作型 PATCH（sortOrder/remindAt） | 不帶 baseUpdatedAt 或不含 title/description → 不檢查 |
| 409 時正在打字 | 編輯器重載成 server 版（方案 2 已知會丟本地這次，罕見） |

---

## 7. 測試

- **Dirty**: A 開卡片不編輯 → 觸發 flush（切分頁/失焦）→ 驗證**沒有 PATCH**（server updatedAt 不變）。
- **版本檢查/409**: A、B 同時開同卡（同 updatedAt）。A 編輯+存（server updatedAt 變新）。B 編輯+存（B 的 baseUpdatedAt 已舊）→ server 回 **409** → B 編輯器**靜默重載成 A 的版本**。
- **連續存**: 同 client 連打字多次 debounce 存 → 不應自己 409 自己（base 有更新）。
- **跨裝置重現原事件**: Mac 開舊卡不動 + 手機編輯存 → Mac flush 不覆蓋（dirty）；若 Mac 也編輯則 409 靜默用最新。
