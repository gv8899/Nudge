# Web ↔ Mac 體驗完全對標 Audit（2026-07-02 第四輪）

> 使用者拍板原則：**Web 體驗要和 macOS App 幾乎一樣。Mac 有的 web 都要有；Mac 沒有的 web 可以移除。**
> 鏡頭：交互容器、文案、佈局結構。功能對齊已在第三輪完成（branch `worktree-web-parity-audit` 14 commits）。
> 方法：5 平行 agent 逐 surface 比對（只看 macOS code path）。已剔除誤報（掃描器說 Cards `selected` 沒接線 — 實際 T2 已接，`cards-feed.tsx:227`）。
> ⚠️ 標 [驗證] 的項目 = 掃描 agent 的 absence 類主張，動工前先 grep 確認。

---

## A. 交互模式改動（web → Mac 的方式）

### Calendar
| # | 現況 (web) | 目標 (Mac) | 證據 |
|---|---|---|---|
| A1 | 日檢視點事件 = **向下展開 accordion**（週/月才是 popover）| 三模式**統一走 popover**（Mac `selectedEvent` → `.popover` 480×380）| `calendar-event-item.tsx:32-82` vs `CalendarHostView.swift:120-124` |
| A2 | 日檢視事件卡 = 垂直堆疊（時間 hero 17px → 標題 12.5px）| **橫向兩欄**：時間欄（min 64pt）+ 標題/地點欄，同一張 tinted 卡 | `CalendarDayView.swift:126-180` |
| A3 | 連線提示 = 左對齊小字小按鈕 | **全屏置中 hero**：56pt icon + 標題 + 置中描述(max 280) + pill CTA | `CalendarConnectPrompt.swift:21-60` vs `calendar-empty-state.tsx:19-56` |
| A4 | 載入態三種各不同（skeleton / 自刻 spinner）| 統一 spinner（Mac `ProgressView` 三模式一致）| `day-view.tsx:81-88` |
| A5 | busy 事件只有日檢視擋點擊、週/月可點 | Mac 不擋；web 自身也不一致 → 統一（跟 Mac：不擋 or 全擋，見決策）| `calendar-event-item.tsx:21,34` |
| A6 | 詳情 popover：內容驅動高度、380 寬 | Mac 固定 480×380 | `event-popover.tsx:47` |

### Daily / Tasks
| # | 現況 (web) | 目標 (Mac) | 證據 |
|---|---|---|---|
| A7 | task modal 窄版 680 + **編輯器 autofocus** | Mac 920×600、**刻意不 autofocus**（`CardDetailView.swift:118-119`）| `task-card.tsx` / `task-detail-modal.tsx:229-236` |
| A8 | modal 標題 blur/Enter 才存 | Mac 打字即 debounce 自動存 | `CardDetailView.swift:312-316` |
| A9 | 快速新增 = FAB toggle **inline composer** | Mac = FAB/⌘N 開 **QuickAddTaskSheet modal**（inline `NewTaskInputView` 是死碼 [驗證]）| `daily-view.tsx:93,477` vs `DailyHostView.swift:1381-1388` |
| A10 | 移動日期 = 點日期立即 commit 的 popover | Mac = 400×480 modal + 標題 + 取消/確認 footer | `move-task-popover.tsx` vs `MoveToDatePickerView.swift:26-65` |
| A11 | 排程編輯 = 平鋪表單、有標題「重複」、無 footer | Mac = **兩張 tinted sectionCard**（重複/提醒）+ row dividers + switch/dropdown + 底部「完成」CTA、**無標題** | `ScheduleSection.swift:61-91` vs `schedule-dialog.tsx` |
| A12 | overdue row 只有 checkbox+排今天+封存 icon | Mac overdue = 完整 `TaskRowMenu`（移動/skip/提醒/封存）+ **右鍵選單** | `overdue-section.tsx:69-112` vs `OverdueSectionView.swift:120-223` |
| A13 | 右面板看 card detail 時 segmented 無 active | Mac 保持「卡片」active | `daily-right-panel.tsx:13` vs `DailyHostView.swift:772-786` |
| A14 | 「今天 (N)」header 任何日期都顯示 | Mac 只在 `isViewingToday` 顯示（**web bug**）| `daily-view.tsx:472-476` vs `DailyHostView.swift:722-726` |

### Cards
| # | 現況 (web) | 目標 (Mac) | 證據 |
|---|---|---|---|
| A15 | 快速 Modal backdrop = 底色 60% + **blur** | Mac = 黑 30% **無 blur**；圓角 16 已一致 | `NudgeModalOverlay.swift:42-45` |
| A16 | Modal 高度 fluid（max 88dvh）| Mac 固定 920×600 | `CardsHostView.swift:160` |
| A17 | Modal 編輯器 autofocus | Mac 無 autofocus | `task-detail-modal.tsx:215` |
| A18 | 全頁 footer = TagPicker + ScheduleSection + 時間戳 | Mac 全頁**無 footer**（tags 走 toolbar 鈕→`TagPickerSheet`；排程在 Mac Cards **完全不可達**，死通知 [驗證]）；web 已有 `embedded` 裁剪版可複用 | `card-detail.tsx:248-268`、註解 `:247` |
| A19 | 全頁標題 = click-to-edit 鈕 + 空標題自動進編輯 | Mac = **永遠可編輯的 TextField**、不強制 focus | `CardDetailView.swift:301-317` |
| A20 | 搜尋框無 clear 鈕；「+」在搜尋列旁 | Mac 搜尋框有 `xmark.circle.fill` clear；+ 在 window toolbar（web 無 toolbar → 保持在列內，可接受）| `CardSearchComponents.swift:36-43` |
| A21 | 空狀態只有一行字 | Mac = 標題 + 描述（`cards.emptyDescription`）+ **建卡 CTA 鈕** | `CardsHostView.swift:370-383` |
| A22 | grid hover 只變 border 色 | Mac hover = `nudgeHoverFill` 背景填充 | `CardGridItemView.swift:74-83` |
| A23 | grid 預覽 line-clamp-4 | Mac lineLimit(5)（字數 240 已一致）；tile footer 分隔線 Mac 沒有 | `CardGridItemView.swift:36-49` |

### Tags / Settings / Shell
| # | 現況 (web) | 目標 (Mac) | 證據 |
|---|---|---|---|
| A24 | TagPicker = popover + **點了立即生效** | Mac = `TagPickerSheet`（460×560 sheet）**本地暫存 + 儲存鈕 commit / X 取消丟棄** | `tag-picker.tsx:32-37` vs `TagPickerSheet.swift:81-95,225-231` |
| A25 | Settings = sidebar 鈕開 **modal**（`/settings` route 存在但沒入口 = 死路由）| Mac = sidebar 選中後 **in-content 顯示**（同 Calendar/Cards 的切換方式）→ web 應改 sidebar 直連 `/settings` route、移除 modal | `PlatformRootView.swift:185-188` vs `app-sidebar.tsx:79-103` |
| A26 | Settings 版面 = 平鋪 divide-y | Mac = **SettingsGroup 卡片**（rounded 12 + 4% tint 背景 + header 有 SF icon + row minHeight 44 + 卡內 divider）| `SettingsView.swift:536-580` |
| A27 | theme = 3 鈕 grid（含 icon）、language = 4 鈕 | Mac 兩者都是 **dropdown Menu**（選中打勾、無 icon）| `SettingsView.swift:321-347` |
| A28 | 危險區順序 = 清卡→登出→刪帳號、鈕帶 icon | Mac = **登出→清卡→刪帳號**、純紅字無 icon | `SettingsView.swift:418-444` |
| A29 | 確認 = inline 換版式 | Mac 全部原生 alert → web 對應 = 統一改 **Dialog**（tag 刪除、登出、清卡、刪帳號、斷開日曆）| `SettingsView.swift:87-168` |
| A30 | 無版本 footer | Mac 底部 `Nudge {ver} ({build})` → web 補 | `SettingsView.swift:449-461` |
| A31 | sidebar 選中 = 灰底全寬 | Mac = **primary 18% tint 圓角 pill**（inset 8pt）| `PlatformRootView.swift:376-411` vs `app-sidebar.tsx:64-68` |
| A32 | 「外觀」區內容不同：web=紙紋理、theme 獨立區 | Mac「外觀」= theme picker（一區搞定）| `SettingsView.swift:321-333` |
| A33 | 日曆連接 = `<a>` 直跳無 loading | Mac 行內 spinner | `SettingsView.swift:300-305` |

### Notes
| # | 現況 (web) | 目標 (Mac) | 證據 |
|---|---|---|---|
| A34 | feed row = **timeline spine**（豎線+圓點+巨大日號 2.25rem+分隔豎線+月/星期堆疊，預覽在下）| Mac = 簡潔**兩欄 pillar**：56pt 日期柱（日號上/縮寫月下）+ 右側預覽、無 timeline、無 weekday | `note-entry.tsx:39-76` vs `NotesFeedView.swift:270-333` |
| A35 | 預覽文字 = text-dim（跟 placeholder 同灰）| Mac 真實內容 = 全對比 foreground、只有 placeholder 才 dim | `NotesFeedView.swift:291` |
| A36 | 選中切換 = 瞬間換 class | Mac = spring 動畫（response .32 damping .86）| `NotesFeedView.swift:62` |
| A37 | 分隔 = 常駐 border-l + handle hover 線 | Mac = **平常完全隱形**，hover/拖曳才顯示 primary 3pt 線 | `ResizeHandle.swift:3-6` vs `notes-split.tsx:353` |
| A38 | 「日誌」標題左右 pane 各一份（雙標題）| Mac 只在 nav chrome 一份 → web 收成一份 | `notes-split.tsx:62,206` |
| A39 | resize handle hover = 灰線、拖曳才 primary | Mac hover 即 primary 3pt（hover=drag 同視覺）| `ResizeHandle.swift:33-39` |

---

## B. 文案 / i18n 對帳（xcstrings ↔ canonical 已漂移）

**原則建議**：wording 以「使用者要的 Mac 體驗」為準 → 把 Mac 現行字串回填 canonical → sync（web 自動跟上），**但 Mac 端疑似 bug 的除外**（改 canonical 為準、之後修 Mac）。

### 改 canonical 對齊 Mac 現行字串
| key | web 現值 | Mac 現值（採用）|
|---|---|---|
| `notes.canvasPlaceholder` | 寫點什麼⋯⋯ | **今天怎麼樣？** |
| `notes.todayPlaceholder` | 開始寫今天的日誌 | **今天 — 還沒開始寫** |
| `calendar.connectDescription` | 看看今天有哪些會議 | **看看今天有哪些行程、會議，跟任務排在一起的安排。** |
| `calendar.eventJoinMeet` | 使用 Google Meet 加入會議 | **加入線上會議** |
| `calendar.eventDescription` | 描述 | **備註** |
| `task.detailClose`（X 鈕）| 關閉 | **完成**（Mac 用 `common.done`；web 直接改用 common.done）|
| `task.detailExpandPage` | 展開為單頁 | **展開**（Mac `daily.popoverExpand`）|
| cards tag chips 清除鈕 | 取消 (`common.cancel`) | **清除 (`common.clear`)** + xmark icon |
| 事件詳情日期格式 | M月d日 (週三) | **M月d日 週三**（無括號，`CalendarEventDetailSheet.swift:180`）|
| 與會者計數 | 與會者 · 3 | **與會者 (3)** |

### Mac 端疑似 bug（canonical 為準、不照抄，記入 Mac 待修）
- `calendar.today` Mac = 「今」（截斷）→ 應為「今天」
- `calendar.thisWeek` Mac = 「今週」（日文污染）→ 應為「本週」
- web `en.json` `notes.monthLabel` = `"{month}"` 裸數字 → 應為縮寫月名（Mac 顯示 "Apr"）——**web bug 要修**

### web 內部不一致（順手收斂）
- 快速 Modal 用 `task.detailContentPlaceholder`、全頁用 `cardDetail.editorPlaceholder` → 統一 `cardDetail.editorPlaceholder`（Mac 兩處共用）；同理 `editTitleAria`
- `task.moveToOtherDay`（移到其他天）實際在用、canonical 另有沒人用的 `task.moveToOtherDate`（移到其他日期 = Mac 用語）→ 收斂成「移到其他日期」
- 排程 dialog 標題「重複」但內含提醒 → Mac 無標題（A11 一起處理）

### key 命名漂移（記錄，暫不動：xcstrings 手動鏡像的歷史債）
`eventAttendees↔attendees`、`modeDay↔viewMode.day`、`prevWeekAria↔prevWeek` 等 — 功能相同，key 名不同。等 xcstrings 對帳輪一起做。

### 孤兒 key（兩邊都沒人用，可刪）[驗證]
web canonical：`cards.cleanUntitledAria`/`cleanDialog*`/`toast*`、`cards.viewListAria`/`viewGridAria`、`notes.goToCanvas`/`goToToday`/`emptyFeedShort`；Mac xcstrings：`daily.skipConfirm*`（skip 確認已從 Mac 移除的遺跡）

---

## C. 移除候選（**2026-07-02 使用者已拍板**，見下表「決定」欄）

拍板摘要：R6/R7 確認框**全拿掉**（對齊 Mac 立即執行）；R2 Google 連結**移除**；R17 紙紋理**移除**；R10 grip 把手**保留**；R15 block 拖曳把手**保留**；R16 click-to-focus 保留；其餘照建議（錯誤處理/URL/手機降級/notifications 保留、死碼清掉）。施工方式：**先合併第三輪功能分支，再開新輪分 surface 分批做。**

| # | 項目 | 位置 | 建議 |
|---|---|---|---|
| R1 | 日檢視 inline accordion | `calendar-event-item.tsx:84-142` | **移除**（A1 改 popover 時自然消失）|
| R2 | 「在 Google Calendar 開啟」連結 | `event-popover.tsx:118-128` | 移除（對齊）或保留（web 才有瀏覽器語境）|
| R3 | Calendar error+retry / reauth 獨立空態 | `calendar-empty-state.tsx:43-72` | **保留**（錯誤處理是 web 必需，Mac 靜默吞錯是缺陷）|
| R4 | Calendar URL state（?mode=&date=）| `calendar-host.tsx:49-54` | **保留**（瀏覽器本質，無 UI 痕跡）|
| R5 | 日檢視週導航 chevrons | `day-view.tsx:69` | **保留**（Mac Day 模式沒有可用導航是 Mac 缺陷）|
| R6 | skip 確認框 | `skip-confirmation-dialog.tsx` | 使用者決定（Mac 立即跳過不確認）|
| R7 | 封存確認框 ×2 | `task-card.tsx:260-287`、`overdue-section.tsx:118-146` | 使用者決定（Mac 立即封存）|
| R8 | inline quick-add composer | `task-create.tsx` | **移除**、改 Mac 式 modal（A9）|
| R9 | overdue row 的 M/d 日期 badge | `overdue-section.tsx:83-90` | 移除（對齊）|
| R10 | 拖曳 grip handle 圖示 | `task-card.tsx:136-143` | 使用者決定（Mac 整 row 可拖、無把手；web 無把手會影響可發現性）|
| R11 | Cards 全頁 footer（排程+時間戳）| `card-detail.tsx:248-268` | **移除排程+時間戳**；tags 入口另設（Mac 是 toolbar 鈕，web 需替代位置）|
| R12 | `/cards/[id]`、`/notes/[date]` deep-link routes | routes | **保留**（URL 本質；視覺無差異）|
| R13 | `/notes/feed` 手機路由 + 手機 toggle | `notes-split.tsx:227-287` | **保留**（手機降級必需，Mac 無手機形態）|
| R14 | Notes timeline spine 視覺 | `note-entry.tsx:43-51` | **移除**（A34 改 Mac pillar 式）|
| R15 | Notes block 拖曳把手 | `notes-canvas-editor.tsx:56-63` | 使用者決定（編輯器能力，Mac 編輯器沒有）|
| R16 | Notes click-anywhere-to-focus | `notes-canvas-editor.tsx:84-90` | 使用者決定（隱形 UX，不影響視覺一致）|
| R17 | 紙紋理外觀開關 | `settings-content.tsx:226-252` | 使用者決定 |
| R18 | 帳號區 avatar + 加入日期 | `settings-content.tsx:131-159` | 移除（對齊 Mac：Email/Name 兩行）|
| R19 | Notifications 偏好設定區 | `notifications-section.tsx` | **保留**（web 推播偏好後端在用；Mac 缺這 UI 是 Mac 待補）|
| R20 | Settings modal（改 in-content 後）| `settings-modal.tsx` | **移除**（A25 改 route 後 modal 冗餘）|
| R21 | `/admin` | route | **保留**（營運工具，本來就不在 nav）|
| R22 | 死碼：`card-list-item.tsx`、`NewTaskInputView.swift`[驗證]、孤兒 i18n keys | 各處 | **刪**（兩邊都清）|
| R23 | 手機 bottom tab bar + md icon-rail 中間態 | `app-sidebar.tsx:144-172` | **保留 bottom bar**（手機必需）；icon-rail 中間態可改成 Mac 式二態（<breakpoint 全隱藏）— 使用者決定 |

---

## D. Mac 端待修清單（本輪發現、回頭修 Mac）
- `calendar.today`=「今」、`calendar.thisWeek`=「今週」文案 bug
- Mac Day 模式無週導航（`CalendarHostView` 沒訂閱 prev/nextWeekNotification）
- Mac calendar 載入失敗靜默吞錯（無 error/retry UI）
- Mac Settings 缺 notifications 偏好 UI（repo 已注入未呈現）
- xcstrings 多處與 canonical 漂移（上面 B 節）＋ `daily.skipConfirm*` 遺跡 keys
