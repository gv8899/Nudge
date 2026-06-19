# Nudge 金流 / 訂閱 / Mac 更新 策略評估

> 狀態：**策略決策文件（draft）**，非實作計畫。實作前再走 brainstorming → writing-plans。
> 寫於 2026-06，依據與 Mike 的討論 + 當下（2026 上半）法規/市場查證。
> **更新 2026-06-20**：拍板「先綁卡試用」、iOS IAP **與 web 同價（吃 Apple 抽成）**；新增 **§5.1 跨平台帳號識別（Sign in with Apple）** —— web 需支援 Apple 登入，否則 Apple 隱藏信箱用戶被鎖在 iOS。

---

## 1. 目標 & 範圍

- 把 Nudge 變成**付費訂閱產品**，跨 **Web / iOS / Mac / Flutter** 四端共用同一訂閱狀態。
- **盡量降低 Apple 抽成**（Web/Mac = 0%），同時**保留 iOS 作為付費管道**。
- Mac（DMG 分發、非 App Store）要有**版本更新檢測 + 提示**機制。
- 收款主體假設為**台灣公司**（見 §4 待驗證）。

---

## 2. 商業模式（已拍板）

- **付費才能用**：7 天免費試用 → 到期必須訂閱（Premium-only，無永久免費階）。
- **先綁卡試用（已拍板）**：試用前先收付款方式，**試用到期自動扣款轉正式**。
  - Web/Mac：Paddle 結帳時綁卡。
  - iOS：Apple intro free trial（用 Apple ID 既有付款方式，等同綁卡；扣款/退訂由 Apple 管）。
  - **試用唯一性綁 `user_id`**（不綁裝置/Apple ID），重裝換機不重置；已在某管道試用過，另一管道不再給試用。
- **年訂閱為主**，**月訂閱當價格錨點**（突顯年費便宜）。
- entitlement = **全有/全無**（不分功能顆粒度）。

---

## 3. 定價

### 3.1 主價 + 錨點（提案，可調）
- **年費 $99 USD**（= $8.25/mo，年繳）。
- **月費 $12.99 USD**（錨點）→ 年費**省 ~37%**。
  - 想更強的「便宜感」可用 $14.99/mo（省 45%），但對任務 app 偏貴，**建議 $12.99**。
- 頁面**預設顯示年費**（讓使用者錨定較低的月均價），再讓他切月費。

### 3.2 同類行情（定位參考）
| App | 年費 | 月均 |
|---|---|---|
| TickTick | $36 | ~$3 |
| Todoist Pro | $48 | ~$4–5 |
| Fantastical | $60 | ~$5 |
| **Nudge（提案）** | **$99** | **$8.25** |
| Sunsama | $192 | ~$17 |

→ $99/yr 屬「**premium 每日規劃**」（在 Sunsama 之下、遠高於 Todoist/TickTick）。**定價偏高，必須靠價值訊息（跨四端、每日規劃、行事曆整合）撐住**；若轉換不理想，可考慮降到 $59–79/yr。

### 3.3 在地化定價（PPP 提案）
Paddle（MoR）支援在地化定價，VAT 地區自動含稅顯示。

| 市場 | 年費 | 月費 | 備註 |
|---|---|---|---|
| 🇺🇸 美國 | $99 | $12.99 | 基準 |
| 🇯🇵 日本 | ¥14,800 | ¥1,500 | 圓整數；日圓弱，貼近 USD 值 |
| 🇸🇪🇳🇴🇩🇰🇫🇮 北歐 | €99+ | €12.99 | 高所得可平/略高；**含 25% VAT**（Paddle 處理） |
| 🇹🇼 台灣 | NT$1,990 | NT$249 | WTP 較低，**PPP 折 ~30%** |

### 3.4 iOS 價格平價（已拍板：同價）
- iOS IAP 只能用 **Apple 各國價格階**（無法任意定價），且 Apple 抽 **15%**（Small Business Program，年營收 < $1M）。
- **決策：iOS IAP 與 web 同價**，多出來的 15% **由我方吸收**，不另調高 —— 維持跨平台一致的價格體感。
- **美國/EU 仍可在 App 內告知「網頁訂閱」**（anti-steering 已放寬）當紅利，但**不調整 iOS 標價**。

---

## 4. 金流架構：Paddle（MoR）為主

### 4.1 為什麼 MoR 而非 Stripe（PSP）
| | Stripe（PSP） | Paddle（MoR） |
|---|---|---|
| 抽成 | ~2.9% + 30¢ | ~5% + 50¢ |
| 法律賣方 | **你** | **Paddle** |
| 全球稅 | 你自己註冊/申報（US 各州/JP JCT/北歐 VAT） | **Paddle 全包**（200+ 轄區代收代繳） |
| 台灣公司可直接用 | ❌（需設美國/SG 公司） | ✅（**已確認**，見 §4.3） |
| 「後續好處理」 | ❌ 稅務壓你 | ✅✅ 稅/發票/退款/催款全包 |

→ 在「**台灣主體 + 美/日/北歐/台四地高稅市場 + 小團隊要省心**」下，**MoR(Paddle) 壓倒性勝出**；多付 ~2% 買掉「設外國公司 + 跨四國報稅 + 開發票」整包。

### 4.2 為什麼是 Paddle（vs Lemon Squeezy / Polar）
- **Paddle**：單一費率涵蓋國際 + PayPal、稅務轄區最成熟 → **對台灣賣家最合適**（美/日/北歐對 TW 都是「國際」交易）。
- **Lemon Squeezy**（Stripe 旗下）：國際交易 +1.5%、PayPal +1.5%、非美 payout 1% → 你的客群幾乎全國際，**實際費率更高**。但**明確支援非美 payout** → 是 Paddle 的好 fallback。
- **Polar**：訂閱功能（比例計費、催款）有缺口，較適合簡單買斷。

### 4.3 ✅ 已確認：Paddle 收台灣賣家
- **官方 Help Center 用排除法**：「Paddle works with software businesses **anywhere in the world** except unsupported (制裁) countries」（Russia / Belarus / Iran / North Korea…）。**台灣不在排除名單 → 台灣公司可註冊為 Paddle 賣家。**
- **Payout 到台灣**：**Payoneer**（台灣常用、最順）/ **SWIFT 國際電匯**（每筆約 $15）/ **PayPal**。**月結**：每月 1 號建立 payout、15 號前匯出，最低門檻 $100。
- **仍要注意**：Paddle 賣家有**人工 KYC 審核**（可能要求補件），風控偶有 hold 款 → 上線前先**實際註冊跑通 KYC**確認帳號核准（這是流程確認，非國家資格問題）。
- **Fallback（萬一 KYC 不過）**：① Lemon Squeezy（支援非美 payout）；② 設美國 LLC / 新加坡公司。

來源：[Paddle Help — Which countries are supported](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle) ・ [Paddle Help — When and how do I get paid](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid)

---

## 5. 跨平台 entitlement 架構（核心；已有一半）

> Nudge 已有**帳號系統 + 共用後端** → 跨平台付費最難的部分已具備。

```
[Web/Mac 結帳 → Paddle]──webhook──┐
[iOS → StoreKit IAP]──RevenueCat──┤──→ 後端 entitlement（綁 user 帳號）
                                  ┘         │
                                  四端登入都讀同一個 → 解鎖 Premium
```

- entitlement 存後端（user 的訂閱狀態：active / trial / expired + 到期日 + 來源管道）。
- **任一管道付款 → 寫進同一個 entitlement → iOS/Mac/Web/Flutter 全解鎖**。
- 退款 / 取消 / 續訂失敗 → 由 Paddle webhook（web）/ RevenueCat（iOS）通知 → **自動撤銷 entitlement**。

### 5.1 跨平台帳號識別（Sign in with Apple 雷 — 上線前必補）

entitlement 綁 `user_id`，所以「同一個人在四端解析到**同一個帳號**」是地基。最大的雷是 **Sign in with Apple + 隱藏信箱**：

- iOS 普遍用 SIWA（App Store 4.8 要求提供）。使用者可選「隱藏我的 Email」→ Apple 給 `xxx@privaterelay.appleid.com` 中繼信箱。
- 這種人要用 **Web/Mac**，**必須也用 Sign in with Apple 登入**（不能用 Google：隱藏信箱 ≠ Google email，email 比對不到 → 變兩個帳號、看不到自己的訂閱）。
- **Web 目前只有 Google**（`src/lib/auth.ts`，且 `signIn` 用 `users.email` 比對、強制要 email）→ **要補 Apple 登入**。
- Apple 的 web 流程走 **Services ID + Sign in with Apple JS / NextAuth Apple provider**，**任何瀏覽器/OS 都能用 —— Windows / Linux / Android 只要有 Apple ID 即可，與裝置無關**（native SIWA 才限 Apple 裝置）。

**關鍵設定（做錯 = 同一人變兩個帳號）**
1. **Services ID 必須群組在 iOS 同一個 primary App ID 底下** → web 與 iOS 拿到的 `sub`（使用者識別碼）/中繼 email 才一致。沒群組 = web 的 `sub` 與 iOS 不同 = 兩個帳號（最常踩）。
2. **比對主鍵改用 Apple `sub`**（schema 加 `apple_sub` 欄位），email 退為次要 —— 中繼 email 雖通常穩定，但撤銷再授權可能變。iOS 端 `/api/auth/mobile`（用 email 找/建 user）也要一起對齊用 sub。
3. **私密信箱中繼**：要寄收據/通知給隱藏 email 者，須在 Apple 後台註冊寄件網域，否則中繼轉發被擋。
4. `name` 只在「**第一次**」授權時回傳 → 首次登入就要存。

**落地清單**：web `/login` 加 Apple 按鈕（Google / Apple 兩顆）→ NextAuth 加 Apple provider → schema 加 `apple_sub`、登入比對 sub 優先 → Apple Developer 建 Services ID 並群組到 iOS App ID → 設定私密信箱中繼網域。

---

## 6. 各管道

| 管道 | Apple 抽成 | 金流 | 備註 |
|---|---|---|---|
| **Web 結帳** | 0% | Paddle | 主戰場、最便宜 |
| **Mac app（DMG）** | 0% | Paddle（App 內導去 web 結帳） | App Store 外、Apple 碰不到 |
| **iOS** | 15% | StoreKit IAP（+ RevenueCat） | 轉換最高；美國可加外部連結到 web（現 0%） |

### iOS 外部連結的法律狀態（2026/6）
- 美國：iOS 內**可放外部付費連結、目前 0% 抽成**，但**法律未定**（2025/12 上訴法院說 Apple 可收費、2026/4/28 發回地院定費率、Apple 還要上訴最高法院）。
- **策略**：**不要只賭外部連結的 0%**；以「iOS IAP 15%（穩、轉換高）+ 外部連結（吃紅利）」兩手。

---

## 7. 稅務 & 發票

- **美/日/北歐**：Paddle（MoR）**全包**（含日本 JCT 適格請求書、北歐 VAT 24–25%）。
- **台灣**：**先統一走 Paddle**（信用卡/Apple Pay，無統一發票、無 LINE Pay）。
  - 若 TW 成為重點市場 / 客群要發票 → **未來再針對台灣客接綠界/藍新**（發票 + LINE Pay；USPACE 已用藍新）。**此為 phase 2，非現在做**。
  - ⚠️ **藍新/綠界只能收台灣客**：結算 TWD、需 TW 公司+TW 銀行戶；外國發卡（日/美/歐）拒付率高、不處理當地稅、無外幣/在地化定價/MoR → **日/美/歐一律走 Paddle**，藍新不可作國際收款主力。

---

## 8. Mac 版本更新機制：Sparkle

- **Sparkle** = 非 App Store Mac app 的標準更新框架，與現有 **Developer ID 簽章 + notarize + DMG** 流程相容。
- 運作：App 啟動/定期抓 `appcast.xml` → 有新版跳「更新可用」對話框 → 背景下載新 DMG → 一鍵更新（支援 delta）。
- 接入步驟：
  1. SPM 加 Sparkle → `Info.plist` 設 `SUFeedURL` + EdDSA public key。
  2. 每次出版本跑 `generate_appcast`（吃 build 的 DMG）產 `appcast.xml`，連 DMG 傳上 host（nudge.tw 靜態路徑 / S3 / GitHub Releases）。
  3. （建議）後端加「最低支援版本」欄位 → 太舊版本可**強制提示更新**。
- 注意：Sparkle 是 **pull（定期檢查）**，非 push；「有新版會被提示」這需求它滿足。真要 push 才另接通知。

---

## 9. 待確認 / 風險

1. ~~**【地基】Paddle 收台灣賣家 + payout**~~ — **已確認可行**（官方排除法、台灣不在制裁名單；payout 走 Payoneer/SWIFT/PayPal，§4.3）。剩「實際註冊跑通 KYC」；不過則 fallback = Lemon Squeezy / 設美國·SG 公司。
2. **定價數字** — $99/yr 偏 premium，需價值訊息撐；月費 $12.99 與 PPP 在地價為提案，待微調。
3. **RevenueCat 與 Paddle 的對接** — iOS 用 RevenueCat（StoreKit），web 用 Paddle webhook → 後端 entitlement；兩邊合流要設計（RevenueCat 不原生整合 Paddle）。
4. **iOS App 審核** — 上 IAP 需符合 App Store 規範；外部連結用美國 entitlement。
5. **【新】Web Sign in with Apple + sub 比對**（§5.1）— Apple 隱藏信箱用戶若 web 不支援 Apple 登入，會被鎖在 iOS、看不到訂閱。Services ID 群組設定 + `apple_sub` 比對是上線前地基。

---

## 10. 分階段落地建議（非逐 task；實作前再寫 plan）

- **Phase 0**：~~確認 Paddle 台灣賣家~~（**已確認可行，§4.3**）→ 剩「實際註冊跑通 KYC 核准」。
- **Phase 1**：帳號識別地基（web 加 Sign in with Apple + `apple_sub` 比對 + Services ID 群組，§5.1）→ 後端 entitlement schema + Web 訂閱（Paddle，先綁卡試用）+ 試用邏輯（綁 user_id）+ 四端 paywall/讀取。
- **Phase 2**：iOS StoreKit IAP（+ RevenueCat、同價、intro free trial）+ entitlement 合流；Mac 導去 web 結帳。
- **Phase 3**：Mac Sparkle 自動更新。
- **Phase 4（視需要）**：台灣在地金流（綠界/藍新 + 發票）、PPP 在地價微調、美國外部連結。

---

## Sources（查證於 2026/6）

- Apple 外部付費連結 / Epic 案 2025–2026：[MacRumors](https://www.macrumors.com/2025/12/11/apple-app-store-fees-external-payment-links/) ・ [2026 費率現況 Neon](https://www.neonpay.com/blog/apple-app-store-alternative-payment-fees-what-developers-pay-in-2026)
- Small Business Program 15%：[RevenueCat](https://www.revenuecat.com/blog/engineering/small-business-program/)
- Stripe 不支援台灣公司：[supportedcountries / RedStag](https://redstagfulfillment.com/how-many-countries-does-stripe-operate-in/) ・ [Is Stripe Available in Taiwan](https://persuasion-nation.com/is-stripe-available-in-taiwan/)
- Stripe vs Paddle vs Lemon Squeezy 比較：[globalsolo](https://www.globalsolo.global/blog/stripe-vs-paddle-vs-lemon-squeezy-2026) ・ [fintechspecs](https://fintechspecs.com/blog/stripe-vs-paddle-vs-lemon-squeezy-vs-polar-merchant-of-record-b2b-saas/)
- Stripe Link = 錢包非 MoR / Stripe Managed Payments：[Dodo](https://dodopayments.com/blogs/is-stripe-a-merchant-of-record) ・ [Paddle](https://www.paddle.com/resources/stripe-managed-payments)
- 年/月訂閱錨點折扣慣例：[InnerTrends](https://www.innertrends.com/blog/saas-pricing-strategies) ・ [InfluenceFlow](https://influenceflow.io/resources/saas-pricing-page-best-practices-a-complete-2026-guide/)
- 同類 app 行情：[toolfinder](https://toolfinder.com/best/to-do-list-apps)
- PPP 在地化定價：[Dodo PPP](https://dodopayments.com/blogs/purchasing-power-parity-pricing-saas) ・ [Kinde](https://kinde.com/learn/billing/optimization-and-revenue/localized-and-ppp-pricing/)
- Sparkle：[官方文件](https://sparkle-project.org/documentation/) ・ [App Store 外分發指南](https://www.rambo.codes/posts/2021-01-08-distributing-mac-apps-outside-the-app-store)
