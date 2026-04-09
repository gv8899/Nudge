# 色系設計：墨水紙張 (Ink &amp; Paper)

## 摘要

取代目前抄自 Heptabase 的配色，建立 nudge 自己的色彩識別。整體方向為「墨水紙張」—— 仿日記本的暖色紙感與墨黑筆觸。Dark mode 為主要使用情境，Light mode 為次要但仍需精細調整。

## 設計決策

| 項目 | 決定 |
|------|------|
| 風格方向 | 墨水紙張 (Ink &amp; Paper) |
| 主要模式 | Dark mode |
| 主色 | 沉香木 (Sepia Amber) |
| 狀態色組合 | 塵土色階 (Earth Tones) |
| 全色系基調 | 帶輕微暖色調，避開純灰 |

## 完整色票

### Dark Mode

#### 背景與表面層次

| Token | Hex | 用途 |
|-------|-----|------|
| `--background` | `#1c1b18` | 主背景 |
| `--card` | `#252320` | 卡片、popover |
| `--muted` | `#2c2a25` | hover 背景、次要區塊 |
| `--border` | `#3a3833` | 一般邊框 |
| `--border-strong` | `#4a4740` | 強調邊框 |
| `--divider` | `#5a564d` | 分隔線 |

#### 前景文字層次

| Token | Hex | 用途 |
|-------|-----|------|
| `--foreground` | `#ebe5d4` | 主要文字 |
| `--text-dim` | `#9b9485` | 次要文字（日期、標籤、說明） |
| `--text-faint` | `#6b665a` | 暗淡文字（disabled、placeholder） |

#### 狀態色（塵土色階）

| 狀態 | Token | Hex |
|------|-------|-----|
| 暫記 inbox | `--status-inbox` | `#9b9080` |
| 待排入 backlog | `--status-backlog` | `#7a8b9c` |
| 自己處理中 in_progress | `--status-in-progress` | `#c89968` |
| 等待他人 waiting | `--status-waiting` | `#a78aaf` |
| 完成 done | `--status-done` | `#8aa57d` |
| 已封存 archived | `--status-archived` | `#666666` |

#### 語意色

| Token | Hex | 用途 |
|-------|-----|------|
| `--primary` | `#c89968` | 主色（按鈕、連結、focus、勾選完成、所有日期顏色） |
| `--destructive` | `#b56b5a` | 刪除、錯誤、警告 |

註：`--primary` 與 `--status-in-progress` 共用相同色，因為「處理中」就是該狀態下使用者最關心的任務。

### Light Mode

#### 背景與前景

| Token | Hex | 用途 |
|-------|-----|------|
| `--background` | `#faf7ef` | 主背景（米白紙） |
| `--card` | `#f3eee0` | 卡片 |
| `--muted` | `#ebe5d4` | hover 背景 |
| `--border` | `#d8d2bf` | 一般邊框 |
| `--foreground` | `#1c1b18` | 主要文字（墨黑） |
| `--text-dim` | `#6e6855` | 次要文字 |
| `--text-faint` | `#a89e85` | 暗淡文字 |

#### 狀態色（Light Mode 微調）

Light mode 的狀態色需略微加深（降低 lightness）以維持對比，色相不變：

| 狀態 | Hex |
|------|-----|
| 暫記 | `#7a7060` |
| 待排入 | `#5a6b7c` |
| 處理中 | `#a87a45` |
| 等待 | `#8a6d92` |
| 完成 | `#5a7050` |
| 封存 | `#888888` |

#### 語意色（Light Mode）

| Token | Hex |
|-------|-----|
| `--primary` | `#a87a45` |
| `--destructive` | `#9a4f3f` |

## 應用原則

1. **所有顏色必須來自 token**，禁止硬編碼 hex 或使用 Tailwind 預設色（如 `amber-400`、`blue-500`）
2. **狀態色使用方式**：
   - 文字 + 細邊框：`color: status; border: 1px solid status; background: status/10%`
   - 不要做大面積色塊填滿
3. **主色克制使用**：只用在「主要操作」（送出按鈕、勾選完成、focus ring）
4. **destructive 限破壞性操作**：刪除按鈕、錯誤訊息，不要當裝飾色
5. **過期任務區塊**使用 `--primary` 作為強調色（與「處理中」狀態共用，視覺上一致）

## 變更影響

### 需要更新的檔案

- `src/app/globals.css` — 整份替換 dark mode + light mode CSS 變數
- `src/lib/constants.ts` — `TASK_STATUSES` 內的 color/bgColor 全部換成新色
- `tailwind.config` 或 `globals.css` 內 `@theme inline` — 確認所有 token 都有對應的 Tailwind class

### 不需更動

- 各元件內的 token 引用方式（已用 `text-foreground`、`text-text-dim` 等語義 token）
- shadcn/ui 預設元件（自動繼承 token）

## 邊界情況

1. **既有元件用了 chart-1 ~ chart-5**：保留 chart-* 變數但對應到新色，避免破壞 chart 元件
2. **TipTap editor 樣式**：`globals.css` 內的 `.tiptap` 樣式引用了 `--foreground`、`--muted-foreground`、`--border` 等，會自動跟著新色
3. **shadcn 預設色**（primary、secondary、accent）：仍保留並指向新色

## 不在範圍內

- 主題切換 UI（已存在 `.dark` class，本次不動）
- 自訂主題功能（使用者選色）
- 額外的色彩語意（success/warning/info 等）—— 用 status 色或 primary 即可
