# Mac DMG 自動更新機制 設計 (Sparkle + 後端最低版本硬閘)

**Goal:** 讓 nudge.tw 下載的 Mac 版（非 App Store、Developer ID + notarize）能**自動檢測新版並提示更新**，並具備**最低版本硬閘**防止過舊版本撞 breaking change。

**Architecture:** Mac app 內嵌 Sparkle 框架做「軟更新」（背景檢查 appcast → 對話框 → 下載新 DMG → 一鍵替換）；另查後端 `minMacBuild` 做「硬閘」（過舊版本啟動時擋住主畫面強制更新）。appcast.xml + DMG 託管在 nudge.tw（Zeabur volume/storage，手動上傳）。

**Tech Stack:** Sparkle 2.x (SPM)、EdDSA 簽章、SwiftUI（擋板）、Next.js API（min-version config）、`build-dmg.sh` 既有流程 + generate_appcast。

---

## 1. 範圍 & 非範圍

**範圍**
- `Nudge-macOS` target 整合 Sparkle 軟更新。
- 後端 `minMacBuild` 設定 + endpoint；Mac app 啟動硬閘。
- `build-dmg.sh` 加 appcast 生成步驟。
- EdDSA 金鑰產生與保管流程文件化。

**非範圍（YAGNI）**
- iOS 走 App Store，不在此（endpoint 預留 `minIosBuild` 欄位即可，先不接 app）。
- beta / 多更新頻道。
- CI 全自動發布（DMG 的 hdiutil/憑證綁本機，維持手動上傳）。

---

## 2. 元件與資料流

```
[Nudge-macOS app (Release)]                    [nudge.tw  (Zeabur volume/storage)]
  ├─ Sparkle(SPM, 只連 macOS target)             ├─ https://nudge.tw/downloads/appcast.xml
  │   啟動 + 每日檢查 appcast → 軟更新對話框        └─ https://nudge.tw/downloads/Nudge-1.0.0-NNN.dmg
  │       └─ 背景下載 DMG → EdDSA 驗章 → 替換重啟
  └─ 啟動查 GET /api/app-config { minMacBuild }
        └─ 自身 build < minMacBuild → 全螢幕擋板（強制更新）
                    │
                    └──→ [Next.js 後端：minMacBuild 來自 env NUDGE_MIN_MAC_BUILD]
```

---

## 3. app 端（Sparkle，位於 `Nudge-macOS` target）

- **依賴**：Sparkle 2.x 經 SPM 加入，**只連 `Nudge-macOS`**（NudgeUI 為 iOS/mac 共用、不可連 Mac-only 框架）。更新程式碼住在 mac app 殼層。
- **Updater**：`SPUStandardUpdaterController`（Sparkle 內建 UI）。
  - App 選單加「檢查更新…」(`checkForUpdates`)。
  - 背景自動檢查（啟動 + 排程）；有新版跳對話框 → 背景下載 → 替換重啟。
- **Info.plist**（project.yml `Nudge-macOS.info.properties`）：
  - `SUFeedURL` = `https://nudge.tw/downloads/appcast.xml`
  - `SUPublicEDKey` = EdDSA 公鑰（generate_keys 產）
  - `SUEnableAutomaticChecks` = `YES`
  - `SUScheduledCheckInterval` = `86400`（每日）
- **只在 Release/分發版啟用**：`#if !DEBUG` 才初始化 updater + 硬閘檢查（開發機不被打擾）。
- **Sandbox**：分發版未開 sandbox → Sparkle 安裝 XPC 正常。app 不在 `/Applications` 時 Sparkle 會提示先搬移。

---

## 4. EdDSA 金鑰（Sparkle 專用，與 Developer ID 無關）

- 用 Sparkle 的 `generate_keys` 產一對 EdDSA 金鑰：**私鑰存 build 機 Keychain**（預設），**公鑰**填 Info.plist `SUPublicEDKey`。
- 每個 DMG 由 `generate_appcast` 用私鑰簽 → `sparkle:edSignature` 進 appcast；app 用公鑰驗 → 防假更新。
- ⚠️ **私鑰另外備份**（匯出存密碼管理器），**絕不進 git**。弄丟 = 無法再發可被現有 app 接受的更新。
- 公鑰可進 git（在 Info.plist，公開無妨）。

---

## 5. appcast 生成 & 發布

- `appcast.xml`（Sparkle RSS feed）每版一 `<item>`：
  - `<sparkle:version>` = build 號（`CURRENT_PROJECT_VERSION`）
  - `<sparkle:shortVersionString>` = `MARKETING_VERSION`
  - `<sparkle:edSignature>` = EdDSA 簽章
  - `<enclosure url=".../Nudge-1.0.0-NNN.dmg" length=… />`
  - `<sparkle:minimumSystemVersion>` = `15.0`
  - 重大版本可加 `<sparkle:criticalUpdate>`（更強力提示）。
- **`build-dmg.sh` 加 `▶ [9/9] generate appcast`**：DMG 打完後跑 `generate_appcast <資料夾>`（用 Keychain 私鑰簽）→ 輸出 `appcast.xml` 到 `~/Downloads`（與 DMG 同處）。
- **發布**：把**新 DMG + 更新後的 appcast.xml** 一起手動上傳到 nudge.tw 的 Zeabur volume/storage（沿用現有上傳 DMG 的路徑），對外路徑 `https://nudge.tw/downloads/`。
- 保留**最近數版** DMG 可下載（appcast 主要列最新；generate_appcast 掃資料夾算 delta 用）。

---

## 6. 後端最低版本硬閘

- **設定來源**：env `NUDGE_MIN_MAC_BUILD`（整數；未設或 `0` = 不擋）。改它不必改 app（Zeabur 改環境變數即可）。
- **Endpoint**：`GET /api/app-config` → `{ "minMacBuild": <number>, "minIosBuild": 0 }`（`minIosBuild` 先預留、回 0）。無需認證（公開設定）。
- **app 行為**（`Nudge-macOS`，`#if !DEBUG`）：
  - 啟動時 `GET /api/app-config`，比對自身 `CURRENT_PROJECT_VERSION`：
    - `自身 >= minMacBuild` → 正常。
    - `自身 < minMacBuild` → 蓋**全螢幕擋板**（標題「此版本已過舊，請更新」+「立即更新」鈕 → 觸發 Sparkle `checkForUpdates`），擋板期間 app 不可用。
  - **fail-open**：請求失敗（網路/後端掛）→ **不擋**（避免後端一抖鎖死所有人）。
- 文案 i18n：`update.required.title` / `update.required.body` / `update.required.button`（canonical → sync → xcstrings）。

---

## 7. build-dmg.sh 整合

- 現有 8 步（archive → re-sign → notarize .app → staple → DMG → sign/notarize/staple DMG → move）**不動**。
- 新增 `▶ [9/9] generate appcast`：`generate_appcast` 掃含新 DMG 的資料夾 → 產 `appcast.xml` → 放 `~/Downloads`。
- hdiutil 步驟仍在使用者自己的 Terminal 跑（既有 TCC 限制，見 `docs` 既有記錄）。

---

## 8. 錯誤處理 / 邊界

| 情況 | 行為 |
|---|---|
| appcast 連不到 | Sparkle 靜默跳過、不 nag |
| 簽章不符 / 被掉包 | Sparkle 拒裝（EdDSA 驗證） |
| 降級（appcast 版本較低） | 不 offer |
| 後端 min-version 查不到 | 硬閘 fail-open（不擋） |
| Debug build | Sparkle + 硬閘都跳過 |
| app 不在 /Applications | Sparkle 提示先搬移 |

---

## 9. 測試

- **軟更新**：本機架假 appcast（指向較高版號的測試 DMG）→ 跑 app → 「檢查更新」→ 走完下載/替換/重啟。
- **硬閘**：`NUDGE_MIN_MAC_BUILD` 設成高於現版 → app 啟動跳全螢幕擋板；設回低值 → 恢復；斷網 → 不擋。
- **build-dmg.sh**：跑完確認 `~/Downloads/appcast.xml` 產生、含正確版號 + 簽章。

---

## 10. 使用者側手動步驟（無法由 agent 代勞）

1. 跑一次 `generate_keys`、**備份私鑰**、把公鑰填進 Info.plist（agent 會把產生指令與填入位置準備好）。
2. 每次發版：build DMG（hdiutil 在自己 Terminal）→ 把 DMG + appcast.xml 上傳 nudge.tw storage。
3. Zeabur 設 `NUDGE_MIN_MAC_BUILD`（要硬閘時才設）。
4. 互動測試（軟更新對話框 / 硬閘擋板）。
