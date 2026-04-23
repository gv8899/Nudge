# 日曆 Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增獨立日曆 tab（Day/Week/Month 三 view），移除行動頁的 `CalendarSectionView` 今日行程 section，設定從 tab bar 搬到行動頁右上角 gear icon。

**Architecture:** 日曆 tab 用 `CalendarHostView` 作 root，依 `@AppStorage("calendar.view.mode")` 切換 `CalendarDayView` / `CalendarWeekView` / `CalendarMonthView`。資料從 `CalendarRepository.events(start:end:)` 拉取，range 依 view 決定。未連結時 `CalendarConnectPrompt` 蓋全版面。點事件 → `CalendarEventDetailSheet`（含「加入線上會議」按鈕）。

**Tech Stack:** SwiftUI（iOS 18+ / macOS 15+）、Swift 6.0 strict concurrency、`@Environment` 注入 `CalendarRepository`，i18n 走 `Text(key, bundle: .module)` + xcstrings。

---

## File Structure

### Create (`apple/NudgeKit/Sources/NudgeUI/Calendar/`)
- `CalendarViewMode.swift` — enum `{ day, week, month }`
- `CalendarHostView.swift` — tab root view
- `CalendarDayView.swift` — 單日事件 list
- `CalendarWeekView.swift` — 7 天 agenda list
- `CalendarMonthView.swift` — 月曆 grid + 下方 list
- `CalendarMonthGrid.swift` — 純 func 算 6-week grid（便於 unit test）
- `CalendarEventDetailSheet.swift` — 事件詳情 sheet
- `CalendarConnectPrompt.swift` — 未連結全版面 CTA

### Create tests (`apple/NudgeKit/Tests/NudgeCoreTests/Phase5/`)
- `CalendarRepositoryRangeTests.swift` — 新增 range 查詢的 unit test
- `CalendarMonthGridTests.swift` — 月曆 grid 切片邏輯

### Modify
- `apple/NudgeKit/Sources/NudgeCore/CalendarRepository.swift` — 新增 `events(start:end:)`
- `apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift` — tab 重排
- `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift` — 移除 `CalendarSectionView`、加 header + settings icon
- `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings` — 新增 i18n keys
- `src/messages/{zh-TW,en,ja}.json` — web 同步 i18n keys

---

### Task 1: i18n keys（xcstrings + web messages）

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`
- Modify: `src/messages/zh-TW.json`
- Modify: `src/messages/en.json`
- Modify: `src/messages/ja.json`

- [ ] **Step 1: 在 xcstrings 加入 calendar + nav keys**

打開 `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`，在 `strings` 物件內（依 key 字典序）插入以下區塊：

```json
"nav.calendar" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "Calendar" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "カレンダー" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "日曆" } }
  }
},
"calendar.viewMode.day" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "Day" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "日" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "日" } }
  }
},
"calendar.viewMode.week" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "Week" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "週" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "週" } }
  }
},
"calendar.viewMode.month" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "Month" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "月" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "月" } }
  }
},
"calendar.weekEmpty" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "Nothing this week" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "今週は予定がありません" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "這週沒有行程" } }
  }
},
"calendar.joinMeeting" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "Join meeting" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "会議に参加" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "加入線上會議" } }
  }
},
"calendar.attendees" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "Attendees" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "参加者" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "與會者" } }
  }
},
"calendar.description" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "Notes" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "メモ" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "備註" } }
  }
},
"calendar.thisWeek" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "This week" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "今週" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "今週" } }
  }
},
"calendar.connectDescription" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "See your meetings alongside today's tasks." } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "会議とタスクを一緒に確認。" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "看看今天有哪些行程、會議，跟任務排在一起的安排。" } }
  }
},
```

- [ ] **Step 2: Web zh-TW messages 加 calendar keys**

在 `src/messages/zh-TW.json` 的 `"calendar"` block 底部（`mobileConnectPrompt` 之後）加入：

```json
"viewMode": {
  "day": "日",
  "week": "週",
  "month": "月"
},
"weekEmpty": "這週沒有行程",
"joinMeeting": "加入線上會議",
"attendees": "與會者",
"description": "備註",
"thisWeek": "今週",
"connectDescription": "看看今天有哪些行程、會議，跟任務排在一起的安排。"
```

在 `"nav"` block 內加入 `"calendar": "日曆"`。

- [ ] **Step 3: Web en + ja messages 同步**

`src/messages/en.json`：

```json
"viewMode": { "day": "Day", "week": "Week", "month": "Month" },
"weekEmpty": "Nothing this week",
"joinMeeting": "Join meeting",
"attendees": "Attendees",
"description": "Notes",
"thisWeek": "This week",
"connectDescription": "See your meetings alongside today's tasks."
```
`nav.calendar`: `"Calendar"`

`src/messages/ja.json`：
```json
"viewMode": { "day": "日", "week": "週", "month": "月" },
"weekEmpty": "今週は予定がありません",
"joinMeeting": "会議に参加",
"attendees": "参加者",
"description": "メモ",
"thisWeek": "今週",
"connectDescription": "会議とタスクを一緒に確認。"
```
`nav.calendar`: `"カレンダー"`

- [ ] **Step 4: Commit**

```bash
git add apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings src/messages/
git commit -m "i18n(calendar): add tab + view mode + detail sheet keys"
```

---

### Task 2: `CalendarViewMode` enum

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarViewMode.swift`

- [ ] **Step 1: 建立 enum**

```swift
import SwiftUI

public enum CalendarViewMode: String, CaseIterable, Identifiable, Sendable {
    case day, week, month
    public var id: String { rawValue }

    public var labelKey: LocalizedStringKey {
        switch self {
        case .day: "calendar.viewMode.day"
        case .week: "calendar.viewMode.week"
        case .month: "calendar.viewMode.month"
        }
    }
}

/// UserDefaults key for persisting the user's preferred mode.
public enum CalendarPreferenceKey {
    public static let viewMode = "calendar.view.mode"
}
```

- [ ] **Step 2: 跑 `xcodegen generate` + 確認 iOS build 過**

```bash
cd /Users/mike/Documents/nudge/apple && xcodegen generate
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD" | head -5
```
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add apple/
git commit -m "feat(calendar): CalendarViewMode enum + @AppStorage key"
```

---

### Task 3: `CalendarRepository.events(start:end:)` + unit test

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeCore/CalendarRepository.swift`
- Test: `apple/NudgeKit/Tests/NudgeCoreTests/Phase5/CalendarRepositoryRangeTests.swift`

- [ ] **Step 1: 寫 failing test**

建立 `apple/NudgeKit/Tests/NudgeCoreTests/Phase5/` 目錄，新增檔案：

```swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("CalendarRepository.events range", .serialized) @MainActor
struct CalendarRepositoryRangeTests {
    @Test func rangeQueryIncludesEndDate() async throws {
        var capturedURL: URL?
        MockURLProtocol.handler = { request in
            capturedURL = request.url
            let body = """
            {"connected":true,"events":[]}
            """
            let data = body.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CalendarRepository(client: client)
        _ = try await repo.events(start: "2026-04-24", end: "2026-04-30")
        let query = capturedURL?.query ?? ""
        #expect(query.contains("date=2026-04-24"))
        #expect(query.contains("endDate=2026-04-30"))
    }
}
```

- [ ] **Step 2: 跑 test 看 fail**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit && swift test --no-parallel --filter CalendarRepositoryRangeTests 2>&1 | tail -10
```
Expected: 編譯錯誤 — `events(start:end:)` 不存在

- [ ] **Step 3: 實作方法**

在 `apple/NudgeKit/Sources/NudgeCore/CalendarRepository.swift` 的 `events(date:)` 方法下方新增：

```swift
    /// Fetches events across a date range [start ... end] (inclusive, YYYY-MM-DD).
    /// Server maps `date` + `endDate` params; behaviour matches single-day call
    /// when `start == end`.
    public func events(start: String, end: String) async throws -> [CalendarEventDTO] {
        let response: EventsResponse = try await client.get(
            "/api/calendar/events?date=\(start)&endDate=\(end)"
        )
        if response.connected == false {
            isConnected = false
            return []
        }
        isConnected = true
        return response.events ?? []
    }
```

- [ ] **Step 4: 跑 test 看 pass + 全 suite pass**

```bash
swift test --no-parallel 2>&1 | tail -3
```
Expected: `Test run with 64 tests in 15 suites passed`

- [ ] **Step 5: Commit**

```bash
git add apple/
git commit -m "feat(core): CalendarRepository.events(start:end:) range query"
```

---

### Task 4: `CalendarMonthGrid` pure helper + unit test

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarMonthGrid.swift`
- Test: `apple/NudgeKit/Tests/NudgeCoreTests/Phase5/CalendarMonthGridTests.swift`

目前 Monthgrid helper 放在 NudgeUI，但 pure func 可以放共用位置。為了 unit test，改放到 NudgeCore 或讓它 Sendable-safe。這裡選 **放在 NudgeUI 但 public**，用 `@testable import NudgeUI` 測。

- [ ] **Step 1: 寫 failing test**

```swift
import Testing
import Foundation
@testable import NudgeUI

@Suite("CalendarMonthGrid", .serialized)
struct CalendarMonthGridTests {
    let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2 // Monday
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    private func date(_ y: Int, _ m: Int, _ d: Int) -> Date {
        DateComponents(calendar: calendar, year: y, month: m, day: d).date!
    }

    @Test func aprilSixWeekGrid() {
        // April 2026: 1 Apr is Wed. Grid starts Mon 30 Mar, 6 weeks × 7.
        let grid = CalendarMonthGrid.dates(forMonthContaining: date(2026, 4, 15), calendar: calendar)
        #expect(grid.count == 6)
        for week in grid { #expect(week.count == 7) }
        #expect(calendar.component(.day, from: grid[0][0]) == 30)
        #expect(calendar.component(.day, from: grid[0][1]) == 31)
        #expect(calendar.component(.day, from: grid[0][2]) == 1)
    }

    @Test func februaryLeapYearGrid() {
        // Feb 2028 is leap: 29 days, starts Tue.
        let grid = CalendarMonthGrid.dates(forMonthContaining: date(2028, 2, 10), calendar: calendar)
        #expect(grid.count == 6)
        // 29 Feb must appear exactly once
        let allDays = grid.flatMap { $0 }
        let feb29Count = allDays.filter {
            calendar.component(.year, from: $0) == 2028 &&
            calendar.component(.month, from: $0) == 2 &&
            calendar.component(.day, from: $0) == 29
        }.count
        #expect(feb29Count == 1)
    }
}
```

- [ ] **Step 2: 跑 test 看 fail**

```bash
swift test --no-parallel --filter CalendarMonthGridTests 2>&1 | tail -10
```
Expected: 編譯錯誤 — `CalendarMonthGrid` 不存在

- [ ] **Step 3: 實作 helper**

建立 `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarMonthGrid.swift`：

```swift
import Foundation

/// Pure functions for computing the 6-week fixed month grid used by
/// `CalendarMonthView`. Kept separate so the date maths is unit-testable
/// without spinning up SwiftUI.
public enum CalendarMonthGrid {
    /// Returns a 6-row × 7-column grid of dates covering the month that
    /// contains `anchor`. Padded with days from the previous and next
    /// months so every row has 7 dates. First column respects
    /// `calendar.firstWeekday`.
    public static func dates(
        forMonthContaining anchor: Date,
        calendar: Calendar
    ) -> [[Date]] {
        guard let monthRange = calendar.range(of: .day, in: .month, for: anchor),
              let monthStart = calendar.date(
                from: calendar.dateComponents([.year, .month], from: anchor)
              )
        else { return [] }

        // Find the weekday of the 1st, then walk back to grid start.
        let firstWeekday = calendar.component(.weekday, from: monthStart)
        let shift = (firstWeekday - calendar.firstWeekday + 7) % 7
        guard let gridStart = calendar.date(byAdding: .day, value: -shift, to: monthStart)
        else { return [] }

        // 6 weeks × 7 days = 42 cells.
        var rows: [[Date]] = []
        for week in 0..<6 {
            var row: [Date] = []
            for day in 0..<7 {
                let offset = week * 7 + day
                if let d = calendar.date(byAdding: .day, value: offset, to: gridStart) {
                    row.append(d)
                }
            }
            rows.append(row)
        }
        _ = monthRange
        return rows
    }
}
```

- [ ] **Step 4: 跑 test 看 pass**

```bash
swift test --no-parallel --filter CalendarMonthGridTests 2>&1 | tail -5
```
Expected: `Test run with 2 tests in 1 suites passed`

- [ ] **Step 5: Commit**

```bash
git add apple/
git commit -m "feat(calendar): CalendarMonthGrid pure helper for 6-week grid"
```

---

### Task 5: `CalendarConnectPrompt`

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarConnectPrompt.swift`

- [ ] **Step 1: 建立 view**

```swift
import SwiftUI
import NudgeCore

/// Full-screen CTA shown in the Calendar tab when Google Calendar
/// isn't connected yet. Reuses the existing CalendarOAuthCoordinator.
public struct CalendarConnectPrompt: View {
    @Environment(CalendarRepository.self) private var calendarRepo
    @State private var oauth = CalendarOAuthCoordinator()
    @State private var isConnecting = false
    @State private var error: String?

    public init() {}

    public var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "calendar")
                .font(.system(size: 56, weight: .regular))
                .foregroundStyle(Color.nudgePrimary)

            Text("calendar.connectTitle", bundle: .module)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)

            Text("calendar.connectDescription", bundle: .module)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeTextDim)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)

            Button(action: connect) {
                HStack {
                    if isConnecting {
                        ProgressView().controlSize(.small)
                    }
                    Text("calendar.connectTitle", bundle: .module)
                        .foregroundStyle(Color.nudgePrimaryForeground)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 10)
                .background(Capsule().fill(Color.nudgePrimary))
            }
            .buttonStyle(.plain)
            .disabled(isConnecting)

            if let error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(Color.nudgeDestructive)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.nudgeBackground)
    }

    private func connect() {
        error = nil
        isConnecting = true
        Task {
            defer { isConnecting = false }
            do {
                let url = try await calendarRepo.mobileStart()
                try await oauth.present(connectURL: url)
                await calendarRepo.refreshConnectionStatus()
            } catch CalendarOAuthCoordinator.ConnectError.userCancelled {
                // silent
            } catch let err {
                error = String(describing: err)
            }
        }
    }
}
```

- [ ] **Step 2: 確認 build 過**

```bash
cd /Users/mike/Documents/nudge/apple && xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD" | head -5
```
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add apple/
git commit -m "feat(calendar): CalendarConnectPrompt CTA for disconnected state"
```

---

### Task 6: `CalendarEventDetailSheet`

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarEventDetailSheet.swift`

- [ ] **Step 1: 建立 view**

```swift
import SwiftUI
import NudgeCore
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// Read-only event details presented as a bottom sheet.
/// Sections render only when their underlying field is non-empty.
public struct CalendarEventDetailSheet: View {
    public let event: CalendarEventDTO

    public init(event: CalendarEventDTO) {
        self.event = event
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    timeAndTitle

                    if !event.hangoutLink.isEmpty, let url = URL(string: event.hangoutLink) {
                        joinMeetingButton(url: url)
                    }

                    if let loc = event.location, !loc.isEmpty {
                        infoRow(systemImage: "mappin.and.ellipse", text: loc)
                    }

                    infoRow(systemImage: "calendar", text: event.calendarName)

                    if let desc = event.description, !desc.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("calendar.description", bundle: .module)
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Color.nudgeTextDim)
                            Text(verbatim: desc)
                                .font(.subheadline)
                                .foregroundStyle(Color.nudgeForeground)
                        }
                    }

                    if !event.attendees.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(verbatim: "\(NSLocalizedString("calendar.attendees", bundle: .module, comment: "")) (\(event.attendees.count))")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Color.nudgeTextDim)
                            ForEach(event.attendees, id: \.self) { a in
                                Text(verbatim: "• \(a)")
                                    .font(.subheadline)
                                    .foregroundStyle(Color.nudgeForeground)
                            }
                        }
                    }
                }
                .padding(20)
            }
            .background(Color.nudgeBackground)
        }
        #if os(iOS)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        #endif
    }

    private var timeAndTitle: some View {
        VStack(alignment: .leading, spacing: 6) {
            if event.allDay {
                Text("calendar.eventAllDay", bundle: .module)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.nudgeTextDim)
            } else {
                Text(verbatim: "\(shortTime(event.start)) – \(shortTime(event.end))")
                    .font(.footnote.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.nudgeTextDim)
            }
            Text(verbatim: event.title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)
        }
    }

    private func joinMeetingButton(url: URL) -> some View {
        Button {
            #if os(iOS)
            UIApplication.shared.open(url)
            #elseif os(macOS)
            NSWorkspace.shared.open(url)
            #endif
        } label: {
            Label {
                Text("calendar.joinMeeting", bundle: .module)
            } icon: {
                Image(systemName: "video.fill")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Color.nudgePrimaryForeground)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 10).fill(Color.nudgePrimary))
        }
        .buttonStyle(.plain)
    }

    private func infoRow(systemImage: String, text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .foregroundStyle(Color.nudgeTextDim)
            Text(verbatim: text)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeForeground)
        }
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }
}
```

- [ ] **Step 2: 確認 iOS + macOS build**

```bash
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD" | head -5
xcodebuild -project Nudge.xcodeproj -scheme Nudge-macOS \
  -destination 'platform=macOS' build 2>&1 | grep -E "error:|BUILD" | head -5
```
Expected: 兩次 `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add apple/
git commit -m "feat(calendar): CalendarEventDetailSheet with join-meeting button"
```

---

### Task 7: `CalendarDayView`

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarDayView.swift`

- [ ] **Step 1: 建立 view**

```swift
import SwiftUI
import NudgeCore

/// Single-day event list for the Calendar tab. Uses the shared
/// WeekStripView at the top so date navigation stays consistent
/// with the Action page.
public struct CalendarDayView: View {
    @Binding var selectedDate: String
    @Binding var weekDates: Set<String>
    let events: [CalendarEventDTO]
    let isLoading: Bool
    let onWeekOffset: (Int) -> Void
    let onEventTap: (CalendarEventDTO) -> Void

    public init(
        selectedDate: Binding<String>,
        weekDates: Binding<Set<String>>,
        events: [CalendarEventDTO],
        isLoading: Bool,
        onWeekOffset: @escaping (Int) -> Void,
        onEventTap: @escaping (CalendarEventDTO) -> Void
    ) {
        _selectedDate = selectedDate
        _weekDates = weekDates
        self.events = events
        self.isLoading = isLoading
        self.onWeekOffset = onWeekOffset
        self.onEventTap = onEventTap
    }

    public var body: some View {
        VStack(spacing: 0) {
            WeekStripView(
                selectedDate: selectedDate,
                datesWithTasks: weekDates,
                onSelectDate: { selectedDate = $0 },
                onWeekOffset: onWeekOffset
            )

            if isLoading && events.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if events.isEmpty {
                Text("calendar.panelEmpty", bundle: .module)
                    .font(.subheadline)
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: 14) {
                        ForEach(events, id: \.id) { event in
                            Button { onEventTap(event) } label: {
                                eventRow(event)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
            }
        }
    }

    private func eventRow(_ event: CalendarEventDTO) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Group {
                if event.allDay {
                    Text("calendar.eventAllDay", bundle: .module)
                        .font(.footnote.weight(.heavy))
                } else {
                    Text(shortTime(event.start))
                        .font(.title3.weight(.heavy))
                        .monospacedDigit()
                }
            }
            .foregroundStyle(Color.nudgeForeground)
            .frame(width: 60, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                Text(verbatim: event.title)
                    .font(.callout.weight(.medium))
                    .foregroundStyle(Color.nudgeForeground)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                if let location = event.location, !location.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.caption2)
                        Text(verbatim: location)
                            .font(.caption)
                            .lineLimit(1)
                    }
                    .foregroundStyle(Color.nudgeTextDim)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }
}
```

- [ ] **Step 2: 確認 build**

```bash
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD" | head -5
```
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add apple/
git commit -m "feat(calendar): CalendarDayView reusing WeekStripView"
```

---

### Task 8: `CalendarWeekView`

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarWeekView.swift`

- [ ] **Step 1: 建立 view**

```swift
import SwiftUI
import NudgeCore

/// Agenda-style week list: events grouped by day. Days with no events
/// show an empty placeholder row. Range labelled in the header bar.
public struct CalendarWeekView: View {
    let weekStart: Date
    let weekEnd: Date
    let events: [CalendarEventDTO]
    let isLoading: Bool
    let onPrevWeek: () -> Void
    let onNextWeek: () -> Void
    let onThisWeek: () -> Void
    let onEventTap: (CalendarEventDTO) -> Void

    public init(
        weekStart: Date,
        weekEnd: Date,
        events: [CalendarEventDTO],
        isLoading: Bool,
        onPrevWeek: @escaping () -> Void,
        onNextWeek: @escaping () -> Void,
        onThisWeek: @escaping () -> Void,
        onEventTap: @escaping (CalendarEventDTO) -> Void
    ) {
        self.weekStart = weekStart
        self.weekEnd = weekEnd
        self.events = events
        self.isLoading = isLoading
        self.onPrevWeek = onPrevWeek
        self.onNextWeek = onNextWeek
        self.onThisWeek = onThisWeek
        self.onEventTap = onEventTap
    }

    private var days: [(date: Date, label: String)] {
        var result: [(Date, String)] = []
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        let weekdayFmt = DateFormatter()
        weekdayFmt.dateFormat = "EEEE M/d"
        for i in 0..<7 {
            if let d = calendar.date(byAdding: .day, value: i, to: weekStart) {
                result.append((d, weekdayFmt.string(from: d)))
            }
        }
        return result
    }

    public var body: some View {
        VStack(spacing: 0) {
            header

            if isLoading && events.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if events.isEmpty {
                Text("calendar.weekEmpty", bundle: .module)
                    .font(.subheadline)
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        ForEach(days, id: \.date) { day in
                            dayBlock(date: day.date, label: day.label)
                        }
                    }
                    .padding(16)
                }
            }
        }
    }

    private var header: some View {
        HStack {
            Button(action: onPrevWeek) {
                Image(systemName: "chevron.left")
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            Spacer()
            Text(verbatim: headerRangeLabel)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Button(action: onThisWeek) {
                Text("calendar.thisWeek", bundle: .module)
                    .font(.footnote)
                    .foregroundStyle(Color.nudgePrimary)
            }
            .buttonStyle(.plain)
            Button(action: onNextWeek) {
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
    }

    private var headerRangeLabel: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "M/d"
        return "\(fmt.string(from: weekStart)) – \(fmt.string(from: weekEnd))"
    }

    private func dayBlock(date: Date, label: String) -> some View {
        let iso = DateFormatters.isoDate(date)
        let dayEvents = events.filter { $0.start.hasPrefix(iso) }
        return VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: label)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.nudgeTextDim)
                .textCase(.uppercase)
            if dayEvents.isEmpty {
                Text("calendar.panelEmpty", bundle: .module)
                    .font(.caption)
                    .foregroundStyle(Color.nudgeTextDim)
            } else {
                ForEach(dayEvents, id: \.id) { event in
                    Button { onEventTap(event) } label: {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(event.allDay ? NSLocalizedString("calendar.eventAllDay", bundle: .module, comment: "") : shortTime(event.start))
                                .font(.footnote.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(Color.nudgeForeground)
                                .frame(width: 54, alignment: .leading)
                            Text(verbatim: event.title)
                                .font(.subheadline)
                                .foregroundStyle(Color.nudgeForeground)
                                .lineLimit(1)
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            Rectangle()
                .fill(Color.nudgeBorderLight)
                .frame(height: 1)
        }
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }
}
```

- [ ] **Step 2: 確認 build**

```bash
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD" | head -5
```
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add apple/
git commit -m "feat(calendar): CalendarWeekView agenda list"
```

---

### Task 9: `CalendarMonthView`

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarMonthView.swift`

- [ ] **Step 1: 建立 view**

```swift
import SwiftUI
import NudgeCore

/// Month grid (6 weeks × 7 days) + bottom event list for the selected
/// day. Padding days (prev/next month) are dimmed. Each cell shows up
/// to 3 event dots.
public struct CalendarMonthView: View {
    @Binding var selectedDate: String
    let monthAnchor: Date
    let events: [CalendarEventDTO]
    let isLoading: Bool
    let onPrevMonth: () -> Void
    let onNextMonth: () -> Void
    let onThisMonth: () -> Void
    let onEventTap: (CalendarEventDTO) -> Void
    let onDayDoubleTap: (String) -> Void  // switch back to Day view

    private let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        return c
    }()

    public init(
        selectedDate: Binding<String>,
        monthAnchor: Date,
        events: [CalendarEventDTO],
        isLoading: Bool,
        onPrevMonth: @escaping () -> Void,
        onNextMonth: @escaping () -> Void,
        onThisMonth: @escaping () -> Void,
        onEventTap: @escaping (CalendarEventDTO) -> Void,
        onDayDoubleTap: @escaping (String) -> Void
    ) {
        _selectedDate = selectedDate
        self.monthAnchor = monthAnchor
        self.events = events
        self.isLoading = isLoading
        self.onPrevMonth = onPrevMonth
        self.onNextMonth = onNextMonth
        self.onThisMonth = onThisMonth
        self.onEventTap = onEventTap
        self.onDayDoubleTap = onDayDoubleTap
    }

    private var grid: [[Date]] {
        CalendarMonthGrid.dates(forMonthContaining: monthAnchor, calendar: calendar)
    }

    private var todayIso: String { DateFormatters.isoDate(Date()) }
    private var monthComponent: Int { calendar.component(.month, from: monthAnchor) }

    private func events(on date: Date) -> [CalendarEventDTO] {
        let iso = DateFormatters.isoDate(date)
        return events.filter { $0.start.hasPrefix(iso) }
    }

    private var selectedDayEvents: [CalendarEventDTO] {
        events.filter { $0.start.hasPrefix(selectedDate) }
    }

    public var body: some View {
        VStack(spacing: 0) {
            header
            weekdayHeader
            gridView
            Divider().background(Color.nudgeBorderLight)
            bottomList
        }
    }

    private var header: some View {
        HStack {
            Button(action: onPrevMonth) {
                Image(systemName: "chevron.left")
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            Spacer()
            Text(verbatim: monthTitle)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color.nudgeForeground)
            Spacer()
            Button(action: onThisMonth) {
                Text("calendar.today", bundle: .module)
                    .font(.footnote)
                    .foregroundStyle(Color.nudgePrimary)
            }
            .buttonStyle(.plain)
            Button(action: onNextMonth) {
                Image(systemName: "chevron.right")
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 8)
    }

    private var monthTitle: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy 年 M 月"
        return fmt.string(from: monthAnchor)
    }

    private var weekdayHeader: some View {
        let keys: [LocalizedStringKey] = [
            "weekday.mon", "weekday.tue", "weekday.wed",
            "weekday.thu", "weekday.fri", "weekday.sat", "weekday.sun"
        ]
        return HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { i in
                Text(keys[i], bundle: .module)
                    .font(.caption2)
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 4)
    }

    private var gridView: some View {
        VStack(spacing: 0) {
            ForEach(0..<grid.count, id: \.self) { row in
                HStack(spacing: 0) {
                    ForEach(0..<grid[row].count, id: \.self) { col in
                        cell(date: grid[row][col])
                    }
                }
            }
        }
        .padding(.horizontal, 4)
    }

    private func cell(date: Date) -> some View {
        let iso = DateFormatters.isoDate(date)
        let day = calendar.component(.day, from: date)
        let isSelected = iso == selectedDate
        let isToday = iso == todayIso
        let isPad = calendar.component(.month, from: date) != monthComponent
        let count = events(on: date).count

        return Button {
            if isSelected {
                onDayDoubleTap(iso)
            } else {
                selectedDate = iso
            }
        } label: {
            VStack(spacing: 2) {
                ZStack {
                    if isToday {
                        Circle().fill(Color.nudgePrimary)
                            .frame(width: 26, height: 26)
                    } else if isSelected {
                        Circle().stroke(Color.nudgeBorderLight, lineWidth: 1)
                            .frame(width: 26, height: 26)
                    }
                    Text(verbatim: "\(day)")
                        .font(.footnote.weight(isToday ? .semibold : .regular))
                        .foregroundStyle(dayColor(isToday: isToday, isPad: isPad))
                }
                dots(count: count)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func dayColor(isToday: Bool, isPad: Bool) -> Color {
        if isToday { return .nudgePrimaryForeground }
        if isPad { return .nudgeTextDim.opacity(0.5) }
        return .nudgeForeground
    }

    private func dots(count: Int) -> some View {
        HStack(spacing: 2) {
            if count == 0 {
                Color.clear.frame(width: 4, height: 4)
            } else if count <= 3 {
                ForEach(0..<count, id: \.self) { _ in
                    Circle().fill(Color.nudgePrimary).frame(width: 4, height: 4)
                }
            } else {
                Text(verbatim: "···")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(Color.nudgePrimary)
            }
        }
        .frame(height: 6)
    }

    @ViewBuilder
    private var bottomList: some View {
        if isLoading {
            ProgressView().padding(20)
        } else if selectedDayEvents.isEmpty {
            Text("calendar.panelEmpty", bundle: .module)
                .font(.caption)
                .foregroundStyle(Color.nudgeTextDim)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
        } else {
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(selectedDayEvents, id: \.id) { event in
                        Button { onEventTap(event) } label: {
                            HStack(alignment: .firstTextBaseline, spacing: 10) {
                                Text(event.allDay ? NSLocalizedString("calendar.eventAllDay", bundle: .module, comment: "") : shortTime(event.start))
                                    .font(.footnote.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(Color.nudgeForeground)
                                    .frame(width: 54, alignment: .leading)
                                Text(verbatim: event.title)
                                    .font(.subheadline)
                                    .foregroundStyle(Color.nudgeForeground)
                                    .lineLimit(1)
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
        }
    }

    private func shortTime(_ iso: String) -> String {
        guard let tIndex = iso.firstIndex(of: "T") else { return iso }
        let afterT = iso.index(after: tIndex)
        return String(iso[afterT...].prefix(5))
    }
}
```

- [ ] **Step 2: 加 "calendar.today" 到 xcstrings**

確認 `calendar.today` key 存在於 xcstrings；若不存在，在 Task 1 加入的 keys 旁追加：

```json
"calendar.today" : {
  "localizations" : {
    "en" : { "stringUnit" : { "state" : "translated", "value" : "Today" } },
    "ja" : { "stringUnit" : { "state" : "translated", "value" : "今日" } },
    "zh-Hant" : { "stringUnit" : { "state" : "translated", "value" : "今" } }
  }
}
```

（`common.today` 已有；我們這邊用精簡的 `calendar.today` = 「今」。）

- [ ] **Step 3: 確認 build**

```bash
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD" | head -5
```
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 4: Commit**

```bash
git add apple/
git commit -m "feat(calendar): CalendarMonthView grid + selected-day list"
```

---

### Task 10: `CalendarHostView`

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Calendar/CalendarHostView.swift`

- [ ] **Step 1: 建立 view**

```swift
import SwiftUI
import NudgeCore

/// Root of the Calendar tab. Owns selectedDate, view mode, loaded events,
/// and the event detail sheet. Delegates rendering to Day/Week/Month
/// sub-views.
public struct CalendarHostView: View {
    @Environment(CalendarRepository.self) private var calendarRepo
    @AppStorage(CalendarPreferenceKey.viewMode) private var modeRaw: String = CalendarViewMode.day.rawValue

    @State private var selectedDate: String = DateFormatters.isoDate(Date())
    @State private var events: [CalendarEventDTO] = []
    @State private var weekDates: Set<String> = []
    @State private var isLoading = false
    @State private var selectedEvent: CalendarEventDTO?

    private let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        return c
    }()

    public init() {}

    private var mode: CalendarViewMode {
        CalendarViewMode(rawValue: modeRaw) ?? .day
    }

    private var selectedDateObj: Date {
        DateFormatters.parseISODate(selectedDate) ?? Date()
    }

    private var rangeKey: String {
        let (s, e) = currentRange()
        return "\(mode.rawValue)|\(s)|\(e)"
    }

    public var body: some View {
        NavigationStack {
            Group {
                if !calendarRepo.isConnected {
                    CalendarConnectPrompt()
                } else {
                    modeContent
                }
            }
            .background(Color.nudgeBackground)
            .navigationTitle(Text("nav.calendar", bundle: .module))
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    modePicker
                }
            }
        }
        .task(id: rangeKey) { await reload() }
        .sheet(item: $selectedEvent) { event in
            CalendarEventDetailSheet(event: event)
        }
    }

    @ViewBuilder
    private var modeContent: some View {
        switch mode {
        case .day:
            CalendarDayView(
                selectedDate: $selectedDate,
                weekDates: $weekDates,
                events: events,
                isLoading: isLoading,
                onWeekOffset: offsetWeek,
                onEventTap: { selectedEvent = $0 }
            )
        case .week:
            let start = weekStart(selectedDateObj)
            let end = calendar.date(byAdding: .day, value: 6, to: start) ?? start
            CalendarWeekView(
                weekStart: start,
                weekEnd: end,
                events: events,
                isLoading: isLoading,
                onPrevWeek: { offsetWeek(-1) },
                onNextWeek: { offsetWeek(1) },
                onThisWeek: { selectedDate = DateFormatters.isoDate(Date()) },
                onEventTap: { selectedEvent = $0 }
            )
        case .month:
            CalendarMonthView(
                selectedDate: $selectedDate,
                monthAnchor: selectedDateObj,
                events: events,
                isLoading: isLoading,
                onPrevMonth: { offsetMonth(-1) },
                onNextMonth: { offsetMonth(1) },
                onThisMonth: { selectedDate = DateFormatters.isoDate(Date()) },
                onEventTap: { selectedEvent = $0 },
                onDayDoubleTap: { _ in
                    modeRaw = CalendarViewMode.day.rawValue
                }
            )
        }
    }

    private var modePicker: some View {
        Menu {
            ForEach(CalendarViewMode.allCases) { m in
                Button {
                    modeRaw = m.rawValue
                } label: {
                    Label {
                        Text(m.labelKey, bundle: .module)
                    } icon: {
                        Image(systemName: mode == m ? "checkmark" : "")
                    }
                }
            }
        } label: {
            Image(systemName: "square.grid.3x3")
                .foregroundStyle(Color.nudgePrimary)
        }
    }

    // MARK: - Range

    private func currentRange() -> (String, String) {
        switch mode {
        case .day:
            return (selectedDate, selectedDate)
        case .week:
            let start = weekStart(selectedDateObj)
            let end = calendar.date(byAdding: .day, value: 6, to: start) ?? start
            return (DateFormatters.isoDate(start), DateFormatters.isoDate(end))
        case .month:
            let rows = CalendarMonthGrid.dates(forMonthContaining: selectedDateObj, calendar: calendar)
            let first = rows.first?.first ?? selectedDateObj
            let last = rows.last?.last ?? selectedDateObj
            return (DateFormatters.isoDate(first), DateFormatters.isoDate(last))
        }
    }

    private func weekStart(_ date: Date) -> Date {
        var c = calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: date)
        c.weekday = calendar.firstWeekday
        return calendar.date(from: c) ?? date
    }

    // MARK: - Navigation

    private func offsetWeek(_ by: Int) {
        if let d = calendar.date(byAdding: .day, value: by * 7, to: selectedDateObj) {
            selectedDate = DateFormatters.isoDate(d)
        }
    }

    private func offsetMonth(_ by: Int) {
        if let d = calendar.date(byAdding: .month, value: by, to: selectedDateObj) {
            selectedDate = DateFormatters.isoDate(d)
        }
    }

    // MARK: - Loading

    private func reload() async {
        let (start, end) = currentRange()
        isLoading = true
        defer { isLoading = false }
        do {
            events = try await calendarRepo.events(start: start, end: end)
            // For day view week strip dots — approximate: mark dates that
            // have events in the loaded range.
            weekDates = Set(events.compactMap { event -> String? in
                guard let t = event.start.firstIndex(of: "T") else { return event.start }
                return String(event.start[..<t])
            })
        } catch {
            print("[CalendarHost] reload failed: \(error)")
            events = []
        }
    }
}
```

- [ ] **Step 2: 確認 build**

```bash
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD" | head -5
```
Expected: `** BUILD SUCCEEDED **`

- [ ] **Step 3: Commit**

```bash
git add apple/
git commit -m "feat(calendar): CalendarHostView orchestrates day/week/month + detail sheet"
```

---

### Task 11: `PlatformRootView` tab 重排

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift`

- [ ] **Step 1: 改 iOS TabView**

打開檔案，在 `IOSTabRoot` 的 `TabView` 內：

- 移除 `SettingsView(auth: auth).tabItem { ... nav.settings ... }` 那段
- 在 `DailyHostView()` 之後、`CardsHostView()` 之前，插入：

```swift
CalendarHostView()
    .tabItem {
        Label {
            Text("nav.calendar", bundle: .module)
        } icon: {
            Image(systemName: "calendar")
        }
    }
```

- [ ] **Step 2: 改 macOS sidebar（若 sidebar 有列 settings）**

檢查 `MacOSSplitRoot`（或同檔案 macOS 分支），若有 `.settings` case 作為 sidebar item，**保留** — macOS 習慣 Settings 獨立視窗（透過 ⌘, 或 app menu），此 tab 移除只限 iOS。macOS sidebar 新增 `.calendar` case（若存在 sidebar enum）：

```swift
case .calendar: CalendarHostView()
```

對應 sidebar label 新增一項 calendar 導覽。

- [ ] **Step 3: Build iOS + macOS**

```bash
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD" | head -5
xcodebuild -project Nudge.xcodeproj -scheme Nudge-macOS \
  -destination 'platform=macOS' build 2>&1 | grep -E "error:|BUILD" | head -5
```
Expected: 兩次 `** BUILD SUCCEEDED **`

- [ ] **Step 4: Commit**

```bash
git add apple/
git commit -m "feat(ui): wire Calendar tab into PlatformRootView (iOS + macOS)"
```

---

### Task 12: `DailyHostView` 移除 CalendarSectionView + 加 settings header

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Daily/DailyHostView.swift`

- [ ] **Step 1: 移除 CalendarSectionView 呼叫**

在 iOS layout 的 ScrollView VStack 內，刪掉這段：

```swift
CalendarSectionView(
    events: events,
    isConnected: calendarRepo.isConnected,
    onConnectTapped: connectCalendar
)
```

macOS layout 的左側 sidebar 內也刪：

```swift
VStack(spacing: 0) {
    CalendarSectionView(
        events: events,
        isConnected: calendarRepo.isConnected,
        onConnectTapped: connectCalendar
    )
    Spacer()
}
.frame(width: 300)
.background(Color.nudgeBackground)

Divider()
```

macOS 把 `HStack { sidebar; Divider; main }` 這層整個打平 — 只保留 main 部分。保留 `ZStack(alignment: .bottomTrailing)` 含 FAB。

- [ ] **Step 2: 加 settings header 到 iOS layout**

在 iOS layout 的 `ZStack(alignment: .bottomTrailing)` 內，`VStack(spacing: 0)` 的最上面（`statusBanner` 之前）插入：

```swift
HStack(alignment: .firstTextBaseline) {
    Text("nav.tasks", bundle: .module)
        .font(.largeTitle.weight(.bold))
        .foregroundStyle(Color.nudgeForeground)
    Spacer()
    NavigationLink(value: DailyRoute.settings) {
        Image(systemName: "gearshape")
            .font(.title3)
            .foregroundStyle(Color.nudgePrimary)
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
}
.padding(.horizontal, 16)
.padding(.top, 8)
```

在 `DailyHostView` struct 內新增 enum：

```swift
enum DailyRoute: Hashable { case settings }
```

在 `.navigationDestination(for: DailyAssignmentDTO.self) { ... }` 之後加：

```swift
.navigationDestination(for: DailyRoute.self) { route in
    switch route {
    case .settings:
        SettingsView(auth: auth)
    }
}
```

DailyHostView 需要 auth reference；在 `@Environment(...)` 區塊或 init 傳入（參考既有 PlatformRootView 傳 auth 的模式）：

```swift
public struct DailyHostView: View {
    let auth: AuthRepository
    public init(auth: AuthRepository) { self.auth = auth }
    ...
}
```

然後 PlatformRootView 呼叫改為 `DailyHostView(auth: auth)`。

- [ ] **Step 3: 移除 connectCalendar() 相關 state (若已不用)**

若 CalendarSectionView 是唯一用到 `connectCalendar` / `isConnectingCalendar` / `oauth` 的地方，把 `oauth`、`isConnectingCalendar` state 跟 `connectCalendar()` 方法整個刪掉。保留 events fetch（還是要顯示 week strip dots）。

- [ ] **Step 4: Build iOS + macOS**

```bash
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,id=CEB11490-5C95-4528-9125-B0BB7E02DC0D' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD" | head -5
xcodebuild -project Nudge.xcodeproj -scheme Nudge-macOS \
  -destination 'platform=macOS' build 2>&1 | grep -E "error:|BUILD" | head -5
```
Expected: 兩次 `** BUILD SUCCEEDED **`

- [ ] **Step 5: 重灌模擬器 + 實測**

```bash
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/Nudge-*/Build/Products/Debug-iphonesimulator -name "Nudge-iOS.app" -type d 2>/dev/null | head -1)
xcrun simctl install CEB11490-5C95-4528-9125-B0BB7E02DC0D "$APP_PATH"
xcrun simctl terminate CEB11490-5C95-4528-9125-B0BB7E02DC0D tw.nudge.app 2>/dev/null
xcrun simctl launch CEB11490-5C95-4528-9125-B0BB7E02DC0D tw.nudge.app
```

手動驗證：
- 底部 tab：行動 / 日曆 / 卡片 / 日誌（4 個；設定不見）
- 行動頁右上角 gear icon，點進入設定頁、可返回
- 行動頁中間不再有「今日行程」區塊
- 日曆 tab 預設 Day view、右上角 menu 可切 Week / Month
- Week view 顯示一週 agenda
- Month view 顯示 6-week grid、選日後下方 list 更新
- 點任一事件 → detail sheet 彈出，hangoutLink 非空時有「加入線上會議」按鈕

- [ ] **Step 6: Commit**

```bash
git add apple/
git commit -m "feat(ui): Action page — drop today calendar section, add settings header"
```

---

## Self-Review

**Spec coverage**:
- Tab 重排（4 tab，設定移除）→ Task 11 ✓
- 行動頁 header + gear → Task 12 ✓
- 行動頁移除 CalendarSectionView → Task 12 ✓
- CalendarRepository range query → Task 3 ✓
- CalendarViewMode enum + @AppStorage → Task 2 ✓
- Day view（共用 WeekStripView）→ Task 7 ✓
- Week view（agenda）→ Task 8 ✓
- Month view（6-week grid + bottom list）→ Tasks 4 + 9 ✓
- Event detail sheet（含加入線上會議按鈕）→ Task 6 ✓
- Connect prompt 全版面 CTA → Task 5 ✓
- i18n keys（xcstrings + web）→ Task 1（+ Task 9 Step 2 補 calendar.today）✓
- Unit tests（range query、6-week grid）→ Tasks 3, 4 ✓

**No placeholders**：所有 step 都有明確 code / command。

**Type consistency**：`CalendarViewMode` enum cases (day/week/month) 全一致；`CalendarPreferenceKey.viewMode` 一貫；`CalendarMonthGrid.dates(forMonthContaining:calendar:)` 簽名一致。`DailyRoute.settings` case 新增、使用處一致。
