# 設定 Modal 設計

## 摘要

新增「設定」入口，讓使用者可以查看自己的帳號資料、切換主題（含跟隨系統）、以及登出。設定以 Modal 呈現，從 sidebar 底部齒輪 icon 觸發。

## 設計決策

| 項目 | 決定 |
|------|------|
| 呈現方式 | Modal（彈窗），點 outside / Esc 關閉 |
| 觸發點 | Sidebar 底部齒輪 icon（desktop + mobile bar 都加） |
| 內容範圍 | 帳號資料（唯讀）+ 主題切換 + 登出 |
| 帳號資料 | 唯讀，不可編輯 |
| 主題選項 | Light / Dark / 跟隨系統（3 選 1） |
| 主題儲存 | `localStorage` (`nudge:theme`) |
| 預設主題 | 跟隨系統 |

## 內容區塊

### 1. 帳號資料（唯讀）

顯示欄位：
- **頭像**：圓形，48px，來自 `users.avatar_url`
- **顯示名稱**：來自 `users.name`
- **Email**：來自 `users.email`
- **加入日期**：來自 `users.created_at`，格式 `yyyy/MM/dd`

資料來源：新增 `GET /api/me` endpoint，回傳當前登入 user 資料。

### 2. 主題切換

三個選項以 segmented control 或 radio group 呈現：
- **Light** (太陽 icon)
- **Dark** (月亮 icon)
- **跟隨系統** (顯示器 icon)

行為：
- 點選後立即套用，無需「儲存」按鈕
- 偏好寫入 `localStorage`，key 為 `nudge:theme`，值為 `"light"` / `"dark"` / `"system"`
- 當選 system 時，主題依 `window.matchMedia('(prefers-color-scheme: dark)')` 決定，並監聽變化即時切換

### 3. 登出

- destructive 樣式按鈕（紅色文字 + border），label「登出」
- 點擊呼叫 NextAuth 的 `signOut({ callbackUrl: '/login' })`
- 不需確認對話框（單一 click 行為）

## 技術設計

### 主題系統

**新增 `src/components/providers/theme-provider.tsx`**

Context provider：
```ts
type Theme = "light" | "dark" | "system";

interface ThemeContext {
  theme: Theme;          // 使用者偏好
  resolvedTheme: "light" | "dark";  // 實際解析後的主題
  setTheme: (t: Theme) => void;
}
```

行為：
1. 從 `localStorage.getItem("nudge:theme")` 讀取，預設 `"system"`
2. 解析為 `light` 或 `dark`（system 時用 matchMedia）
3. 在 `<html>` element 上 add/remove `dark` class
4. 監聽 `prefers-color-scheme` change event（僅在 system 模式）
5. `setTheme` 寫入 localStorage 並重新解析

掛在 `src/app/layout.tsx` 的 root，包住 `<body>`。

**避免 FOUC（First Flash of Unstyled Content）**

React hydrate 前 ThemeProvider 還沒跑，會閃爍。在 `<head>` 內 inline 一段同步 script：

```html
<script>
  (function() {
    const stored = localStorage.getItem('nudge:theme');
    const theme = stored || 'system';
    const isDark = theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
  })();
</script>
```

這段 inline 在 ThemeProvider 之前執行，確保第一次 paint 就有正確的主題。

`src/app/layout.tsx` 移除 hardcoded `className="dark"`，改由上述機制動態套用。

### API endpoint

**`GET /api/me`**

```ts
// src/app/api/me/route.ts
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  });
}
```

### Sidebar 改動

`src/components/sidebar/app-sidebar.tsx`：

**Desktop**（左側 sidebar）：
- 上方仍是 Tasks + Notes
- **底部** 新增 Settings 齒輪 icon button，觸發 modal
- 用 `mt-auto` 把 Settings 推到底部

**Mobile**（底部 bar）：
- 加入 Settings 為第三個 nav item
- Tasks / Notes / Settings 平均分配

點擊 Settings 不換頁，而是開啟 Modal。

### Modal 元件

**`src/components/settings/settings-modal.tsx`**

```ts
interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

- 用 `@base-ui/react` 的 Dialog（已在依賴內）
- 寬度 max-w-md，置中
- 內部三個區塊用 `divide-y divide-border` 分隔
- 標題「設定」

### State 管理

Modal 的 `open` 狀態由 `AppSidebar` 內部 `useState` 管理（單一觸發點）。Settings button 與 Modal 都在 `AppSidebar` 內，無需 lift state。

## 邊界情況

1. **未登入**：`/api/me` 回 401，但設定 modal 只在已登入狀態才顯示（受 `(app)/layout.tsx` 的 auth guard 保護），不會發生
2. **頭像 url 無效**：使用 `<img>` 的 `onError` 改顯示首字母 placeholder
3. **localStorage 不可用**（隱私模式）：fallback 為 system 模式，不寫入
4. **SSR**：Theme 偏好只在 client 知道，SSR 時 inline script 在 React 之前執行設定 class

## 不在範圍內

- 編輯個人資料（名稱、頭像）
- 通知設定
- 鍵盤快捷鍵設定
- 資料匯出 / 刪除帳號
- 多語系切換
- 密碼變更（OAuth 登入無此需求）
