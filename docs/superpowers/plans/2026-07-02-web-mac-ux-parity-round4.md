# Web ↔ Mac 體驗對標 第四輪 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。
> **Spec = `docs/web-parity/2026-07-02-web-mac-ux-parity-audit.md`**（含每項的 web/Mac file:line 證據與拍板決定）。本 plan 只做批次切分與補充指示；實作前先讀 audit 對應條目。

**Goal:** Web 體驗對標 macOS App（交互容器/文案/佈局），含拍板的移除項。

**Global Constraints**（每批適用）：
- 顏色只用 design token；i18n 只改 canonical → `npm run i18n:sync`（en/ja 直接填，生成檔不手改）
- 指令 `env -u NODE_OPTIONS` 前綴；每批結尾 `npm test` + `npx next build` + `npm run i18n:check` + changed-files eslint 全綠才 commit
- audit 標 [驗證] 的 absence 主張，動工前先 grep 確認
- Mac 端待修（audit §D）**不在本輪**；「今」「今週」等 Mac bug 不照抄，canonical 維持正確字串
- 保留項（拍板）：grip 把手、block 拖曳把手、click-to-focus、錯誤/reauth 態、URL state、手機 bottom bar 與 /notes/feed、notifications 設定區、/admin、日檢視週導航

---

## Batch 0：文案對帳 + 清理 + 小 bug（audit §B + A14 + R22）
1. canonical 回填 Mac 現行字串（audit §B 表一）：`notes.canvasPlaceholder`→今天怎麼樣？、`notes.todayPlaceholder`→今天 — 還沒開始寫、`calendar.connectDescription`、`calendar.eventJoinMeet`→加入線上會議、`calendar.eventDescription`→備註；en/ja 同步鏡像 xcstrings 對應翻譯（xcstrings 有：How was your day? / Today — start writing 等，用 python 讀 `apple/.../Localizable.xcstrings` 取值）
2. web 內部收斂：Modal X 鈕改用 `common.done`；expand 文案改「展開」（改 `task.detailExpandPage` canonical 值）；快速 Modal 編輯器 placeholder 統一用 `cardDetail.editorPlaceholder`（`task-detail-modal.tsx:213`）；`task.moveToOtherDay` 用語改「移到其他日期」並刪多餘 key（grep 確認）；cards tag chips 清除鈕改 `common.clear`（key 若無則建）+ X icon（`cards-feed.tsx:192-200`）
3. 事件詳情格式：日期去括號（`event-popover.tsx` datePrefix pattern 改 `M月d日 EEE` / en `MMM d EEE`）；與會者計數改 `與會者 (3)` 格式
4. bug：`daily-view.tsx:472-476` todayHeader 只在 `currentDate === isoToday()` 顯示；`i18n/canonical/en.json` `notes.monthLabel` 改 `"{month}"` → 縮寫月名（web 端傳入處若傳數字需改傳 Date 格式化後字串 — 看 `note-entry.tsx:30` 實作決定：直接在元件用 date-fns `MMM` for en）
5. 清理 [驗證後]：刪 `src/components/cards/card-list-item.tsx`（先 grep import）；刪孤兒 canonical keys（cards.clean*/toast*/viewListAria/viewGridAria、notes.goToCanvas/goToToday/emptyFeedShort — 每個先 grep src/ 確認零引用）→ sync
- Commit: `chore(web): 文案對帳回填 canonical + 孤兒 key/死碼清理 + todayHeader/monthLabel 修正`

## Batch 1：Calendar（audit A1-A6 + R1 + R2）
1. **A1** 日檢視事件改 popover：`day-view.tsx` 把 `calendar-event-item` 的 expand 換成 `EventPopover` 包裹（同 week/month 用法）；刪 `calendar-event-item.tsx` 的 accordion 區塊（`:84-142`）與 expandedId state
2. **A2** 日檢視事件卡改橫向兩欄：時間欄固定寬（`w-16` mono）+ 右欄標題/地點，單張 tinted 卡（參 `CalendarDayView.swift:126-180` 的層次：title=rowTitle、time=mono、地點 icon+dim）
3. **R2** 移除 `eventOpenInGoogle` 連結（`event-popover.tsx:118-128`；canonical key 一併刪）
4. **A3** `calendar-empty-state.tsx` not_connected/reauth 變體改全屏置中 hero：大 icon（lucide `CalendarDays` h-14）+ 標題 + 置中描述 max-w-[280px] + pill CTA（參 `CalendarConnectPrompt.swift:21-60`）；error/empty 變體維持
5. **A4** 載入態統一：day 的 skeleton 換成與 week/month 相同的 spinner
6. **A5** busy 事件：對齊 Mac = 不擋點擊（拿掉 `canExpand` gating；popover 顯示 busy 事件現有欄位）
7. **A6** popover 尺寸對齊：`w-[480px]`、內容 max-h 380 overflow-auto
- Commit: `feat(web/calendar): 事件詳情統一 popover + 兩欄事件卡 + 連線 hero + 載入態統一，對齊 Mac`

## Batch 2：Daily / Tasks（audit A7-A14 + R6-R9 + A11）
1. **A7** task modal 改寬版：`task-card.tsx` 的 `TaskDetailModal` 加 `wide`；`task-detail-modal.tsx` autoFocus={false}（Mac 刻意不 focus）
2. **A8** modal 標題改打字即 debounce 存（複用 `DebouncedSaver`，500ms，保留 blur/Enter flush）
3. **A9+R8** quick-add 改 modal：新 `quick-add-dialog.tsx`（Dialog + 單行輸入 + Enter/確認送出，參 `QuickAddTaskSheet`）；FAB 改開 dialog；刪 inline composer 路徑（`task-create.tsx` 若他處無用則刪，先 grep）
4. **A10** `move-task-popover.tsx` 改 Dialog：標題 `task.moveToOtherDate` + 日曆 + 取消/確認 footer（選日不立即 commit）
5. **A11** 排程編輯改 Mac 卡片式：`schedule-section.tsx` 包成兩張 section card（`rounded-xl bg-foreground/[0.04]` + row 結構 minH-12 + divider）重複/提醒分卡；`schedule-dialog.tsx` 去標題、底部加「完成」primary 鈕（=關閉）
6. **A12** overdue row 補 `…` 選單 + 右鍵選單（複用 `task-card.tsx` 的 MenuItems 模式：移到今天/skip 或設重複/提醒/封存）
7. **R6+R7** 砍確認框：skip 立即執行（刪 `skip-confirmation-dialog.tsx` 用法與檔案）、封存立即執行（刪 task-card 與 overdue-section 的確認 Dialog）；canonical 的 skipConfirm*/archiveTitle/archiveConfirmBody 刪（archiveButton 留給選單標籤）
8. **A13** 右面板 detail 時 segmented「卡片」保持 active（`daily-right-panel.tsx:13`）
9. **R9** 移除 overdue row 的 M/d 日期 badge
- Commit: `feat(web/daily): modal/quick-add/移日期/排程表單對齊 Mac + 確認框移除 + overdue 完整選單`

## Batch 3：Cards + TagPicker（audit A15-A24 + R11）
1. **A15-A17** Modal chrome：backdrop 改 `bg-black/30`（無 blur）；wide modal 固定高 `h-[600px]`（內部捲動）；TiptapEditor autoFocus=false
2. **A18+R11** 全頁 `/cards/[id]` 砍 footer：`cards/[id]/page.tsx` 直接複用 `CardDetail` 的 Mac 對齊裁剪（把 footer 從非 embedded 也拿掉：刪 ScheduleSection+時間戳；**tags 入口保留**但改成 header 右側 tag icon 鈕 → 開 dialog 版 TagPicker（對應 Mac toolbar 鈕→TagPickerSheet））
3. **A19** 全頁標題改永遠可編輯 input（拿掉 click-to-edit 兩態與空標題強制編輯，placeholder=untitled）
4. **A21** 空狀態補 `cards.emptyDescription`（canonical 新 key，值取 Mac xcstrings）+ 建卡 CTA 鈕
5. **A20** 搜尋框加 clear（X）鈕（有字時顯示）
6. **A22-A23** grid hover 加 `hover:bg-surface-hover`；預覽 line-clamp-4→5；tile footer 去分隔線
7. **A24** TagPicker 改批次：本地 state 暫存、儲存鈕 commit、取消丟棄；呈現改置中 Dialog（460 寬、max-h 560、header 標題+X、footer 儲存）；用處（cards 全頁、task modal）同步改
- Commit: `feat(web/cards): Modal chrome/全頁裁剪/空狀態/TagPicker 批次儲存，對齊 Mac`

## Batch 4：Settings / Shell（audit A25-A33 + R17/R18/R20 + A31）
1. **A25+R20** Settings 改 in-content：sidebar Settings 項改 `<Link href="/settings">`（active 樣式同其他 nav）；刪 `settings-modal.tsx` 與開關 state；`/settings` route 保持
2. **A26** `settings-content.tsx` 改卡片分組：每 section 包 `rounded-xl bg-foreground/[0.04] p-1` 卡 + header（SF icon 對應 lucide：account=UserCircle、billing=CreditCard、calendar=Calendar、外觀=Palette、語言=Globe、tags=Tag、危險區=AlertTriangle）+ 卡內 row minH-11 + divider
3. **A27** theme/language 改 dropdown（用專案既有 DropdownMenu，選中打勾、無 icon）
4. **A32** 「外觀」區 = theme picker 一區（theme 併入外觀；R17 紙紋理開關刪除 + `useTheme` 相關 prop/canonical key 清理）
5. **A28** 危險區順序改 登出→清卡→刪帳號；行改 Mac 式（整行紅字 action row、無 icon）
6. **A29** 確認統一改 Dialog（登出/清卡/刪帳號/斷開日曆/tag 刪除 — 取代 inline 換版式；沿用 archive dialog 樣式）
7. **A30** 版本 footer：`Nudge {version}`（web 取 `package.json` version，build 號可省）
8. **R18** 帳號區改 Email/Name 兩行（刪 avatar/joinedAt；canonical joinedAt key 留著給未來）
9. **A31** sidebar 選中樣式改 primary tint pill：`bg-primary/[0.18] rounded-md mx-2`（inset）；**A33** 日曆連接鈕加 loading spinner（fetch 前 setState）
- Commit: `feat(web/settings): in-content 路由 + 卡片分組 + dropdown + 危險區/確認框對齊 Mac + 紙紋理移除`

## Batch 5：Notes（audit A34-A39 + R14）
1. **A34+R14** feed row 改 Mac pillar：刪 timeline spine（豎線/圓點/巨大日號/weekday）；改 `flex gap-3`：左 56px 日期柱（日號 `text-xl font-semibold` 上、縮寫月 dim 下）+ 右預覽；`TodayPlaceholderRow` 同步改（placeholder 預覽 = `notes.todayPlaceholder` italic dim）
2. **A35** 真實 entry 預覽改 `text-foreground`（placeholder 才 dim）
3. **A36** 選中切換動畫：row 加 `transition-colors duration-300`（近似 spring fade）
4. **A37+A39** 分隔線：刪 detail pane 常駐 `border-l`；`resize-handle.tsx` hover 即 `bg-primary`（與拖曳同視覺）
5. **A38** 「日誌」標題收成一份（feed pane 保留、detail pane header 只留日期）
- Commit: `feat(web/notes): feed row 改 Mac pillar 式 + 對比/動畫/分隔線收斂`

---

## 收尾
- 全批完成後：`npm test` + `npx next build` + `npm run i18n:check` + `npm run lint`（不新增 error）
- 最終全分支 review（最強模型）→ 修 findings → **使用者瀏覽器總實測** → PR
