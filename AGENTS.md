<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 設計系統

寫任何 UI 之前，先參考既有設計系統，**不要憑空挑顏色或樣式**：

- **Design tokens**：定義在 `src/app/globals.css`（CSS 變數）。可用的語義 token 包含 `background`、`foreground`、`muted`、`muted-foreground`、`primary`、`destructive`、`border`、`text-dim`、`text-faint`、`surface-hover`、`weekend`、以及 `chart-1`～`chart-5`（語義配色）
- **Tailwind 對應**：用 `bg-*`、`text-*`、`border-*` + token 名（例：`text-chart-2` 對應警告/橘黃，`text-text-dim` 對應次要文字）
- **狀態色**：定義在 `src/lib/constants.ts` 的 `TASK_STATUSES`，每個狀態都有 `color` 和 `bgColor`
- **既有元件對齊**：新元件的 layout、間距、checkbox 樣式應參考相似既有元件（如新任務元件先讀 `src/components/task/task-card.tsx`），不要自己另起一套
- **禁止**：硬編碼 hex 色、隨意挑 Tailwind 預設色（`amber-400`、`blue-500` 等都不可），所有顏色必須來自 design system token
