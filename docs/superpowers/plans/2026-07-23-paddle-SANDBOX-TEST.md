# Paddle Sandbox 手測清單

分支 `feat/paddle-checkout`。**程式碼已完成、單元測試綠；端到端流程需要 Paddle sandbox 帳號才能走**——sandbox 免 KYC、註冊即用，跟 live 帳號審核（KYC）互相獨立。

## 步驟 0：開 Paddle sandbox 帳號（一次性，~10 分鐘）

1. 到 **sandbox-login.paddle.com/signup** 註冊（用公司信箱即可，sandbox 不審核）。
2. **Catalog → Products** 建 1 個 Product「Nudge Premium」。
3. 在該 Product 下建 **4 個 Price**：
   | Price | 金額 | Billing cycle | Trial |
   |---|---|---|---|
   | Monthly (trial) | $12.99 USD | monthly | **7 days** |
   | Annual (trial) | $99.00 USD | yearly | **7 days** |
   | Monthly (no trial) | $12.99 USD | monthly | 無 |
   | Annual (no trial) | $99.00 USD | yearly | 無 |
4. **Developer tools → Authentication**：建 API key（server）+ Client-side token。
5. **Developer tools → Notifications**：建 webhook destination 指向 dev tunnel（見步驟 2），勾 `subscription.created / subscription.updated / subscription.canceled / transaction.completed / transaction.payment_failed`，拿 **webhook secret**。

## 步驟 1：env（`.env.local` 補）

```
PADDLE_ENV=sandbox
PADDLE_API_KEY=<sandbox api key>
PADDLE_WEBHOOK_SECRET=<webhook secret>
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=<client token>
PADDLE_PRICE_MONTHLY_TRIAL=pri_xxx
PADDLE_PRICE_ANNUAL_TRIAL=pri_xxx
PADDLE_PRICE_MONTHLY_NOTRIAL=pri_xxx
PADDLE_PRICE_ANNUAL_NOTRIAL=pri_xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 步驟 2：webhook 對 localhost（dev）

Paddle 需要公網 URL 才打得到 webhook：
```bash
# 任選：cloudflared / ngrok
cloudflared tunnel --url http://localhost:3000
# 把得到的 https://xxx.trycloudflare.com/api/webhooks/paddle 填進 Paddle Notifications
```

## 步驟 3：migration

```bash
psql "$DATABASE_URL" -f drizzle/0010_webhook_events.sql
```
（dev/prod 共用 DB，additive 表無風險。）

## 步驟 4：測試卡

| 卡號 | 行為 |
|---|---|
| `4242 4242 4242 4242` | 成功 |
| `4000 0000 0000 0002` | 拒付 |
（到期日任意未來、CVC 任意 3 碼。）

## 步驟 5：流程逐條

### Web（trial 價）
- [ ] 未用過 trial 的帳號登入 → `/paywall` → 預設年繳、顯示「開始 7 天免費試用」
- [ ] 結帳（成功卡）→ overlay 完成 → redirect `/checkout/success` → 30 秒內顯示「訂閱完成 🎉」
- [ ] settings 訂閱區 → 顯示「試用中，剩 7 天」+（active 後）「管理訂閱」
- [ ] DB `subscriptions`：status=trialing、source=paddle、external ids 有值

### Web（無 trial 價）
- [ ] `trial_started_at` 已設的帳號 → `/paywall` 顯示「訂閱 Nudge」（無 trial 文案）→ 結帳即扣款 → status=active

### Webhook 韌性
- [ ] Paddle Dashboard → Notifications → 手動 replay 同一 event → server log `skipped: "duplicate"`
- [ ] 亂送舊 event（或看 log）→ `skipped: "stale"` 不覆蓋新狀態

### Mac OTT
- [ ] Mac DEBUG app（連 localhost）過期帳號 → 付費牆出現（`PAYWALL_ENFORCE_MAC=1` 時）
- [ ] 點「訂閱 Nudge」→ 開瀏覽器 → **免登入**直接落在 /paywall（checkout cookie）→ 完成結帳
- [ ] 回 Mac app（回前景）→ entitlement 自動刷新、付費牆消失
- [ ] OTT 連結放 60 秒後再開 → 導到 login + 「結帳連結逾時」

### 取消 / 拒付
- [ ] Paddle portal（settings「管理訂閱」）取消 → settings 顯示「已取消，使用至 {date}」→（sandbox 可把 period 調短）到期後 → expired
- [ ] 拒付卡訂閱 → dunning → `subscription.updated` past_due → settings「付款失敗」

### 硬牆
- [ ] `PAYWALL_ENFORCE_WEB=1` 重啟 → 過期帳號進任何 app 頁 → 被推到 /paywall；`/paywall`、`/checkout/success` 可達；付費完成後可進 app
- [ ] 關 flag → 立即恢復 soft mode

## Sandbox → Live 切換清單（Paddle 帳號過審後）

1. live Dashboard 重建 Product + 4 Prices（可同時設 PPP 在地價：TW NT$1,990/249、JP ¥14,800/1,500）
2. env：`PADDLE_ENV=production` + live API key / client token / webhook secret / 4 個 live price id
3. Paddle Notifications webhook URL → `https://nudge.tw/api/webhooks/paddle`
4. `NEXT_PUBLIC_APP_URL=https://nudge.tw`
5. prod DB 跑 migration 0010（若尚未）
6. 真卡小額自測一輪（買了再從 portal 退）
7. 翻 `PAYWALL_ENFORCE_WEB=1`、`PAYWALL_ENFORCE_MAC=1`
