# Swift Phase 4：Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iOS + macOS 實作 Web `/cards` 瀏覽 + 搜尋 + 分頁 + 標題編輯 + 新增卡片功能。description 僅只讀純文字預覽（rich-text 編輯器留到獨立 phase）。

**Architecture:** 新 `CardDTO` / `CardRepository`（NudgeCore，network-first 不寫 SwiftData cache）。新 UI 模組 `NudgeUI/Cards/`：iOS `NavigationStack` push；macOS `NavigationSplitView` 300pt sidebar + detail pane。Title save 用 `.onChange` 500ms debounce。

**Tech Stack:** Swift 6、SwiftUI、Swift Testing、`@Observable`、`@SceneStorage`、xcstrings。

**Parent Spec:** `docs/superpowers/specs/2026-04-17-swift-phase4-cards-design.md`

---

## Scope 限制

- 本 plan 只實作 Phase 4。rich-text editor / tag picker / archive 全在後續 phase。
- 完成標準：iOS + macOS 兩端能跑 spec 裡的 DoD checklist。

## File Structure

**Data (NudgeCore)**
- Create: `apple/NudgeKit/Sources/NudgeCore/CardDTO.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/CardRepository.swift`
- Create: `apple/NudgeKit/Sources/NudgeCore/StringHTML.swift`（regex strip）

**i18n**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`（mirror 9 個 Web 既有 cards/cardDetail key）

**UI (NudgeUI/Cards/)**
- Create: `apple/NudgeKit/Sources/NudgeUI/Cards/CardsHostView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Cards/CardListItemView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift`
- Create: `apple/NudgeKit/Sources/NudgeUI/Cards/TagBadgeView.swift`

**Platform integration**
- Modify: `apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift`（tab/sidebar 「卡片」接 CardsHostView）
- Modify: `apple/Nudge-iOS/NudgeiOSApp.swift`（注入 CardRepository）
- Modify: `apple/Nudge-macOS/NudgeMacApp.swift`（同上）

**Tests**
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase4/CardDTOTests.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase4/CardRepositoryTests.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase4/StringHTMLTests.swift`

---

# Block A：Foundation（i18n + HTML strip）

### Task 1: Mirror cards / cardDetail i18n keys to xcstrings

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings`

Phase 4 需要 9 個 key，全部 Web 已有。抄 zh-Hant / en / ja 值，alphabetical 插入 xcstrings。

- [ ] **Step 1: 取出 Web 值**

```bash
cd /Users/mike/Documents/nudge
python3 -c "
import json
keys = ['cards.searchPlaceholder','cards.searchAria','cards.emptyNoCards','cards.emptyWithQuery','cards.loadMore','cards.noMore','cards.createAria','cardDetail.editTitleAria','cardDetail.editorPlaceholder']
for f in ['zh-TW','en','ja']:
    d = json.load(open(f'src/messages/{f}.json'))
    print(f)
    for k in keys:
        parts = k.split('.')
        v = d
        for p in parts: v = v[p]
        print(f'  {k}: {v}')
"
```

Expected output：3 個 locale × 9 個 key 的值。記下來給下一步用。

- [ ] **Step 2: 在 xcstrings 相應字母順序位置插入 9 個 key**

Read 當前 xcstrings。在以下位置插入（按字母順序）：

- `cards.createAria` — 在 `calendar.*` 後、`common.*` 前
- `cards.emptyNoCards` — 緊跟上
- `cards.emptyWithQuery`
- `cards.loadMore`
- `cards.noMore`
- `cards.searchAria`
- `cards.searchPlaceholder`
- `cardDetail.editTitleAria` — 在 `calendar.*` 後、`cards.*` 前
- `cardDetail.editorPlaceholder`

每個 key 用這個 pattern（舉 cards.searchPlaceholder 為例）：

```json
"cards.searchPlaceholder" : {
  "localizations" : {
    "en" : {
      "stringUnit" : {
        "state" : "translated",
        "value" : "Search cards..."
      }
    },
    "ja" : {
      "stringUnit" : {
        "state" : "translated",
        "value" : "カードを検索..."
      }
    },
    "zh-Hant" : {
      "stringUnit" : {
        "state" : "translated",
        "value" : "搜尋卡片..."
      }
    }
  }
},
```

英/日值從 Step 1 的輸出複製；沒讀到 en/ja 值的話回去讀對應 messages 檔。

- [ ] **Step 3: Build 驗**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build 2>&1 | tail -3
```
Expected: Build complete.

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Resources/Localizable.xcstrings
git commit -m "$(cat <<'EOF'
i18n(apple): mirror cards / cardDetail keys from Web messages

9 keys required by Phase 4 cards UI:
cards.createAria, cards.emptyNoCards, cards.emptyWithQuery,
cards.loadMore, cards.noMore, cards.searchAria,
cards.searchPlaceholder, cardDetail.editTitleAria,
cardDetail.editorPlaceholder. All three locales populated from
src/messages/*.json verbatim — no new keys invented.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: HTML strip helper + tests

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/StringHTML.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase4/StringHTMLTests.swift`

Web 用 `src/lib/strip-html.ts`（regex-based）把 Quill/Tiptap 輸出轉純文字。Swift 同樣策略。

- [ ] **Step 1: 寫 failing tests**

Create `apple/NudgeKit/Tests/NudgeCoreTests/Phase4/StringHTMLTests.swift`:

```swift
import Testing
@testable import NudgeCore

@Suite("StringHTML") struct StringHTMLTests {
    @Test func stripsSimpleTags() {
        let html = "<p>Hello <strong>world</strong></p>"
        #expect(html.strippedHTML() == "Hello world")
    }

    @Test func collapsesWhitespace() {
        let html = "<p>foo</p>\n\n<p>bar</p>"
        #expect(html.strippedHTML() == "foo bar")
    }

    @Test func decodesCommonEntities() {
        let html = "&amp; &lt; &gt; &quot; &#39; &nbsp;"
        #expect(html.strippedHTML() == "& < > \" ' ")
    }

    @Test func truncatesToMaxLength() {
        let html = "<p>" + String(repeating: "a", count: 200) + "</p>"
        let out = html.strippedHTML(maxLength: 50)
        #expect(out.count == 50)
    }

    @Test func handlesEmptyAndNilLike() {
        #expect("".strippedHTML() == "")
        #expect("<p></p>".strippedHTML() == "")
    }

    @Test func keepsPlainText() {
        #expect("no tags here".strippedHTML() == "no tags here")
    }
}
```

- [ ] **Step 2: Run test, confirm FAIL (no method)**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter StringHTMLTests --no-parallel 2>&1 | tail -5
```
Expected: compile error — `strippedHTML` 未定義。

- [ ] **Step 3: 實作**

Create `apple/NudgeKit/Sources/NudgeCore/StringHTML.swift`:

```swift
import Foundation

public extension String {
    /// Removes HTML tags, decodes a small set of common entities, and
    /// collapses whitespace. Matches the behaviour of Web's
    /// `src/lib/strip-html.ts` — not a full HTML parser; just enough for
    /// Quill/Tiptap output (paragraphs, lists, inline formatting).
    func strippedHTML(maxLength: Int? = nil) -> String {
        // 1. Drop tags.
        var out = self.replacingOccurrences(
            of: "<[^>]+>",
            with: " ",
            options: .regularExpression
        )

        // 2. Decode common entities.
        let entities: [(String, String)] = [
            ("&amp;", "&"),
            ("&lt;", "<"),
            ("&gt;", ">"),
            ("&quot;", "\""),
            ("&#39;", "'"),
            ("&nbsp;", " ")
        ]
        for (k, v) in entities {
            out = out.replacingOccurrences(of: k, with: v)
        }

        // 3. Collapse whitespace.
        out = out.replacingOccurrences(
            of: "\\s+",
            with: " ",
            options: .regularExpression
        )
        out = out.trimmingCharacters(in: .whitespacesAndNewlines)

        // 4. Truncate if requested.
        if let max = maxLength, out.count > max {
            out = String(out.prefix(max))
        }
        return out
    }
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter StringHTMLTests --no-parallel 2>&1 | tail -5
```
Expected: 6 tests passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/StringHTML.swift \
        apple/NudgeKit/Tests/NudgeCoreTests/Phase4/StringHTMLTests.swift
git commit -m "$(cat <<'EOF'
feat(core): String.strippedHTML helper (mirrors Web strip-html.ts)

Regex-based HTML tag removal + common entity decode + whitespace
collapse + optional truncation. 6 tests cover simple tags, entity
decode, whitespace collapse, empty strings, plain text, and max-
length truncation. Sufficient for Quill/Tiptap preview on the
cards list.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block B：Data layer

### Task 3: CardDTO + CardListDTO + decoding tests

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/CardDTO.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase4/CardDTOTests.swift`

- [ ] **Step 1: 寫 failing tests**

Create `apple/NudgeKit/Tests/NudgeCoreTests/Phase4/CardDTOTests.swift`:

```swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("CardDTO") struct CardDTOTests {
    @Test func cardDecodesWithTags() throws {
        let json = """
        {
          "id": "c1",
          "title": "My card",
          "description": "<p>Hello</p>",
          "updatedAt": "2026-04-17T10:00:00.000Z",
          "tags": [
            {"id": "t1", "name": "Work", "color": "#5a7050", "sortOrder": 0}
          ]
        }
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let card = try decoder.decode(CardDTO.self, from: json)
        #expect(card.id == "c1")
        #expect(card.tags.count == 1)
        #expect(card.tags.first?.name == "Work")
    }

    @Test func cardTolerateNullDescription() throws {
        let json = """
        {
          "id": "c1",
          "title": "My card",
          "description": null,
          "updatedAt": "2026-04-17T10:00:00.000Z",
          "tags": []
        }
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let card = try decoder.decode(CardDTO.self, from: json)
        #expect(card.description == "")
    }

    @Test func cardListDecodes() throws {
        let json = """
        {
          "cards": [
            {"id":"c1","title":"A","description":"","updatedAt":"2026-04-17T10:00:00.000Z","tags":[]}
          ],
          "nextCursor": "2026-04-17T10:00:00.000Z"
        }
        """.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let list = try decoder.decode(CardListDTO.self, from: json)
        #expect(list.cards.count == 1)
        #expect(list.nextCursor == "2026-04-17T10:00:00.000Z")
    }

    @Test func cardListDecodesNullCursor() throws {
        let json = """
        {"cards": [], "nextCursor": null}
        """.data(using: .utf8)!
        let list = try JSONDecoder().decode(CardListDTO.self, from: json)
        #expect(list.nextCursor == nil)
    }
}
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter CardDTOTests --no-parallel 2>&1 | tail -5
```
Expected: compile error — `CardDTO` 未定義。

- [ ] **Step 3: 實作 DTOs**

Create `apple/NudgeKit/Sources/NudgeCore/CardDTO.swift`:

```swift
import Foundation

public struct CardDTO: Codable, Equatable, Sendable, Identifiable, Hashable {
    public let id: String
    public let title: String
    /// Server may return null for cards that never had a body.
    public let description: String
    public let updatedAt: Date
    public let tags: [TagDTO]

    public init(
        id: String,
        title: String,
        description: String,
        updatedAt: Date,
        tags: [TagDTO]
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.updatedAt = updatedAt
        self.tags = tags
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, description, updatedAt, tags
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        updatedAt = try c.decode(Date.self, forKey: .updatedAt)
        tags = try c.decodeIfPresent([TagDTO].self, forKey: .tags) ?? []
    }

    public func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

public struct CardListDTO: Codable, Sendable {
    public let cards: [CardDTO]
    public let nextCursor: String?

    public init(cards: [CardDTO], nextCursor: String?) {
        self.cards = cards
        self.nextCursor = nextCursor
    }
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter CardDTOTests --no-parallel 2>&1 | tail -5
```
Expected: 4 tests passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/CardDTO.swift \
        apple/NudgeKit/Tests/NudgeCoreTests/Phase4/CardDTOTests.swift
git commit -m "$(cat <<'EOF'
feat(core): CardDTO + CardListDTO for Phase 4 cards feed

CardDTO decodes null/missing description to "" (same pattern as
TaskDTO). Identifiable + Hashable for NavigationPath and List id.
CardListDTO wraps {cards: [], nextCursor: String?} matching
Web's GET /api/cards response shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: CardRepository (list + create + refresh) + tests

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeCore/CardRepository.swift`
- Create: `apple/NudgeKit/Tests/NudgeCoreTests/Phase4/CardRepositoryTests.swift`

- [ ] **Step 1: 寫 failing tests**

Create `apple/NudgeKit/Tests/NudgeCoreTests/Phase4/CardRepositoryTests.swift`:

```swift
import Testing
import Foundation
@testable import NudgeCore

@Suite("CardRepository", .serialized) @MainActor
struct CardRepositoryTests {
    private func makeClient(_ body: String, status: Int = 200) -> APIClient {
        MockURLProtocol.handler = { request in
            let data = body.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        return APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
    }

    @Test func listSendsQueryAndCursor() async throws {
        var capturedURL: URL?
        MockURLProtocol.handler = { request in
            capturedURL = request.url
            let data = #"{"cards":[],"nextCursor":null}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CardRepository(client: client)
        _ = try await repo.list(query: "hello", cursor: "2026-04-17T00:00:00Z", limit: 20)

        #expect(capturedURL?.absoluteString.contains("q=hello") == true)
        #expect(capturedURL?.absoluteString.contains("cursor=2026-04-17T00%3A00%3A00Z") == true)
        #expect(capturedURL?.absoluteString.contains("limit=20") == true)
    }

    @Test func listOmitsQueryWhenEmpty() async throws {
        var capturedURL: URL?
        MockURLProtocol.handler = { request in
            capturedURL = request.url
            let data = #"{"cards":[],"nextCursor":null}"#.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CardRepository(client: client)
        _ = try await repo.list(query: "", cursor: nil, limit: 20)

        #expect(capturedURL?.absoluteString.contains("q=") == false)
        #expect(capturedURL?.absoluteString.contains("cursor=") == false)
    }

    @Test func createPostsTaskAndReturnsCard() async throws {
        var capturedBody: String?
        var capturedMethod: String?
        MockURLProtocol.handler = { request in
            capturedMethod = request.httpMethod
            if let body = request.httpBodyStream.flatMap({ stream -> String? in
                stream.open()
                defer { stream.close() }
                var data = Data()
                let bufSize = 1024
                let buf = UnsafeMutablePointer<UInt8>.allocate(capacity: bufSize)
                defer { buf.deallocate() }
                while stream.hasBytesAvailable {
                    let read = stream.read(buf, maxLength: bufSize)
                    if read <= 0 { break }
                    data.append(buf, count: read)
                }
                return String(data: data, encoding: .utf8)
            }) {
                capturedBody = body
            }
            let responseBody = """
            {"id":"c1","title":"","description":"<p></p>","status":"inbox","createdAt":"2026-04-17T10:00:00.000Z","updatedAt":"2026-04-17T10:00:00.000Z"}
            """
            let data = responseBody.data(using: .utf8)!
            let response = HTTPURLResponse(url: request.url!, statusCode: 201, httpVersion: nil, headerFields: nil)!
            return (data, response)
        }
        let client = APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://test.local")!),
            session: .mocked()
        )
        let repo = CardRepository(client: client)
        let card = try await repo.create()

        #expect(capturedMethod == "POST")
        #expect(capturedBody?.contains("\"title\":\"\"") == true)
        #expect(capturedBody?.contains("\"description\":\"<p></p>\"") == true)
        #expect(capturedBody?.contains("\"status\":\"inbox\"") == true)
        #expect(card.id == "c1")
        #expect(card.description == "<p></p>")
    }
}
```

- [ ] **Step 2: Run test, confirm FAIL**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter CardRepositoryTests --no-parallel 2>&1 | tail -5
```
Expected: compile error — `CardRepository` 未定義。

- [ ] **Step 3: 實作**

Create `apple/NudgeKit/Sources/NudgeCore/CardRepository.swift`:

```swift
import Foundation
import Observation

@Observable
@MainActor
public final class CardRepository {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    /// Fetches one page of cards. Pass `cursor = nil` for the first page.
    /// Empty `query` omits the `q=` query parameter.
    public func list(query: String, cursor: String?, limit: Int = 20) async throws -> CardListDTO {
        var components = URLComponents(string: "/api/cards")!
        var items: [URLQueryItem] = [URLQueryItem(name: "limit", value: String(limit))]
        if !query.isEmpty {
            items.append(URLQueryItem(name: "q", value: query))
        }
        if let cursor, !cursor.isEmpty {
            items.append(URLQueryItem(name: "cursor", value: cursor))
        }
        components.queryItems = items
        // URLComponents returns "?" even when there are no items; strip in that case.
        let path = components.string ?? "/api/cards"
        return try await client.get(path)
    }

    /// Creates a new empty card (POST /api/tasks). Returns it as a
    /// CardDTO so the caller can push the detail view immediately.
    public func create() async throws -> CardDTO {
        struct Body: Codable {
            let title: String
            let description: String
            let status: String
        }
        let body = Body(title: "", description: "<p></p>", status: "inbox")
        // Server returns the raw task row. Decode into a shim then
        // rebuild a CardDTO (raw task has no `tags` key — initialize []).
        struct TaskShim: Codable {
            let id: String
            let title: String
            let description: String?
            let updatedAt: Date
        }
        let shim: TaskShim = try await client.post("/api/tasks", body: body)
        return CardDTO(
            id: shim.id,
            title: shim.title,
            description: shim.description ?? "",
            updatedAt: shim.updatedAt,
            tags: []
        )
    }
}
```

- [ ] **Step 4: Run test, confirm PASS**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift test --filter CardRepositoryTests --no-parallel 2>&1 | tail -10
```
Expected: 3 tests passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeCore/CardRepository.swift \
        apple/NudgeKit/Tests/NudgeCoreTests/Phase4/CardRepositoryTests.swift
git commit -m "$(cat <<'EOF'
feat(core): CardRepository — list (with query/cursor) + create

list(query:cursor:limit:) builds GET /api/cards URL via URLComponents,
omitting empty query / nil cursor. create() POSTs an empty-body task
to /api/tasks and wraps the raw task row in a CardDTO (tags=[]),
so the UI layer can push the detail view without an extra fetch.

3 tests cover: query+cursor encoded in URL, empty query omitted,
create sends correct POST body.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block C：UI building blocks

### Task 5: TagBadgeView

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Cards/TagBadgeView.swift`

Tag chip：圓角方塊 + tag color 做 accent。Web 的 `TagBadge` 等效物。顏色來自 server（hex `#RRGGBB`），走 `// nudge:allow-color` 白名單例外。

- [ ] **Step 1: 實作**

Create `apple/NudgeKit/Sources/NudgeUI/Cards/TagBadgeView.swift`:

```swift
import SwiftUI
import NudgeCore

public struct TagBadgeView: View {
    public let tag: TagDTO

    public init(tag: TagDTO) {
        self.tag = tag
    }

    public var body: some View {
        Text(tag.name)
            .font(.caption2)
            .foregroundStyle(Color.nudgeForeground)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                Capsule().fill(parsedColor.opacity(0.2))
            )
            .overlay(
                Capsule().stroke(parsedColor, lineWidth: 0.5)
            )
    }

    private var parsedColor: Color {
        Color(hex: tag.color) ?? Color.nudgeTextDim   // nudge:allow-color
    }
}

private extension Color {
    init?(hex: String) {                               // nudge:allow-color
        let hex = hex.replacingOccurrences(of: "#", with: "")
        guard hex.count == 6, let value = UInt32(hex, radix: 16) else { return nil }
        let r = Double((value >> 16) & 0xff) / 255.0
        let g = Double((value >> 8) & 0xff) / 255.0
        let b = Double(value & 0xff) / 255.0
        self.init(red: r, green: g, blue: b)           // nudge:allow-color
    }
}
```

- [ ] **Step 2: Build 驗**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build 2>&1 | tail -3
```
Expected: Build complete.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Cards/TagBadgeView.swift
git commit -m "$(cat <<'EOF'
feat(ui): TagBadgeView — small capsule chip with per-tag hex accent

tag.color is server-supplied hex (#RRGGBB), so the private
Color(hex:) parser gets nudge:allow-color exceptions from the
token lint. The chip uses a 20% fill + 0.5pt stroke of the parsed
hue, sitting on nudgeBackground.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: CardListItemView

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Cards/CardListItemView.swift`

- [ ] **Step 1: 實作**

Create `apple/NudgeKit/Sources/NudgeUI/Cards/CardListItemView.swift`:

```swift
import SwiftUI
import NudgeCore

public struct CardListItemView: View {
    public let card: CardDTO
    public let onTap: () -> Void

    public init(card: CardDTO, onTap: @escaping () -> Void) {
        self.card = card
        self.onTap = onTap
    }

    public var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(titleText)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.nudgeForeground)
                        .lineLimit(1)

                    Text(preview)
                        .font(.caption)
                        .foregroundStyle(Color.nudgeTextDim)
                        .lineLimit(2)

                    if !card.tags.isEmpty {
                        HStack(spacing: 4) {
                            ForEach(card.tags, id: \.id) { tag in
                                TagBadgeView(tag: tag)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text(updatedShort)
                    .font(.caption2)
                    .foregroundStyle(Color.nudgeTextDim)
                    .monospacedDigit()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var titleText: String {
        card.title.isEmpty ? "—" : card.title
    }

    private var preview: String {
        card.description.strippedHTML(maxLength: 150)
    }

    private var updatedShort: String {
        let cal = Calendar(identifier: .gregorian)
        let m = cal.component(.month, from: card.updatedAt)
        let d = cal.component(.day, from: card.updatedAt)
        return "\(m)/\(d)"
    }
}
```

- [ ] **Step 2: Build 驗**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build 2>&1 | tail -3
```
Expected: Build complete.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Cards/CardListItemView.swift
git commit -m "$(cat <<'EOF'
feat(ui): CardListItemView — list row with title / preview / tags / date

Matches Web's card-list-item.tsx layout: bold title (1 line),
stripped-HTML preview (2 lines, max 150 chars), tag chips, M/d
updated date. Empty title shows an em-dash so the row never
renders as just whitespace.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block D：Detail view

### Task 7: CardDetailView (title edit + description preview)

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift`

- [ ] **Step 1: 實作**

Create `apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift`:

```swift
import SwiftUI
import NudgeCore

public struct CardDetailView: View {
    public let initialCard: CardDTO
    public let onUpdateTitle: (String) -> Void

    @State private var title: String
    @FocusState private var titleFocused: Bool

    public init(card: CardDTO, onUpdateTitle: @escaping (String) -> Void) {
        self.initialCard = card
        self.onUpdateTitle = onUpdateTitle
        _title = State(initialValue: card.title)
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                TextField(text: $title) {
                    Text("cardDetail.editTitleAria", bundle: .module)
                }
                .focused($titleFocused)
                .font(.title2.weight(.semibold))
                .textFieldStyle(.plain)
                .foregroundStyle(Color.nudgeForeground)
                .onChange(of: title) { _, newValue in
                    debouncedSaveTitle(newValue)
                }

                Divider()
                    .background(Color.nudgeBorderLight)

                Text(strippedDescription)
                    .font(.body)
                    .foregroundStyle(
                        strippedDescription.isEmpty
                            ? Color.nudgeTextDim
                            : Color.nudgeForeground
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)

                if !initialCard.tags.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(initialCard.tags, id: \.id) { tag in
                            TagBadgeView(tag: tag)
                        }
                    }
                    .padding(.top, 8)
                }
            }
            .padding(16)
        }
        .background(Color.nudgeBackground)
        .onAppear {
            // Newly created cards arrive with an empty title — jump into edit.
            if initialCard.title.isEmpty {
                titleFocused = true
            }
        }
    }

    private var strippedDescription: String {
        let stripped = initialCard.description.strippedHTML()
        return stripped.isEmpty
            ? NSLocalizedString("cardDetail.editorPlaceholder", bundle: .module, comment: "")
            : stripped
    }

    // MARK: - Debounced save

    @State private var saveWorkItem: DispatchWorkItem?

    private func debouncedSaveTitle(_ newValue: String) {
        saveWorkItem?.cancel()
        let work = DispatchWorkItem { onUpdateTitle(newValue) }
        saveWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }
}
```

- [ ] **Step 2: Build 驗**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build 2>&1 | tail -3
```
Expected: Build complete.

- [ ] **Step 3: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Cards/CardDetailView.swift
git commit -m "$(cat <<'EOF'
feat(ui): CardDetailView — editable title + read-only preview

Title is an inline TextField with nudgeForeground + .title2 semibold.
.onChange debounces 500ms before firing onUpdateTitle — matches Web's
autosave cadence. Newly-created cards (empty title on init) auto-
focus the field via @FocusState.

Description is stripped-HTML Text (not a TextEditor) so rich-text
editing defers cleanly to a future phase. Empty body shows the
"打 / 插入標題、清單..." placeholder in nudgeTextDim.

Tag chips render below the divider when present. Initial card is
passed in from the list — no GET /api/tasks/{id} round trip
(raw task endpoint doesn't return tags anyway).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block E：Host view

### Task 8: CardsHostView — list + search + load more + create

**Files:**
- Create: `apple/NudgeKit/Sources/NudgeUI/Cards/CardsHostView.swift`

這個 view 最複雜。用 @State 管 page + cursor + loading + query，search debounce via `.task(id: debouncedQuery)`。

- [ ] **Step 1: 實作**

Create `apple/NudgeKit/Sources/NudgeUI/Cards/CardsHostView.swift`:

```swift
import SwiftUI
import NudgeCore

public struct CardsHostView: View {
    @Environment(CardRepository.self) private var cardRepo

    @State private var cards: [CardDTO] = []
    @State private var query: String = ""
    @State private var debouncedQuery: String = ""
    @State private var nextCursor: String?
    @State private var isLoading = false
    @State private var isLoadingMore = false
    @State private var hasError = false
    @State private var pushedCard: CardDTO?

    #if os(iOS)
    @State private var navigationPath = NavigationPath()
    #endif

    public init() {}

    public var body: some View {
        #if os(iOS)
        iOSLayout
        #else
        macOSLayout
        #endif
    }

    // MARK: - iOS

    #if os(iOS)
    private var iOSLayout: some View {
        NavigationStack(path: $navigationPath) {
            content
                .background(Color.nudgeBackground)
                .navigationTitle(Text("nav.cards", bundle: .module))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        IconButton(
                            systemName: "plus",
                            accessibilityLabel: "cards.createAria",
                            foreground: .nudgePrimary,
                            action: createCard
                        )
                    }
                }
                .navigationDestination(for: CardDTO.self) { card in
                    CardDetailView(
                        card: card,
                        onUpdateTitle: { updateTitle(cardId: card.id, title: $0) }
                    )
                }
                .searchable(
                    text: $query,
                    placement: .navigationBarDrawer(displayMode: .always),
                    prompt: Text("cards.searchPlaceholder", bundle: .module)
                )
        }
        .task(id: debouncedQuery) { await firstPage() }
        .task(id: query) { await debounceQuery() }
    }
    #endif

    // MARK: - macOS

    #if os(macOS)
    private var macOSLayout: some View {
        NavigationSplitView {
            content
                .background(Color.nudgeBackground)
                .navigationTitle(Text("nav.cards", bundle: .module))
                .searchable(
                    text: $query,
                    prompt: Text("cards.searchPlaceholder", bundle: .module)
                )
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        IconButton(
                            systemName: "plus",
                            accessibilityLabel: "cards.createAria",
                            foreground: .nudgePrimary,
                            action: createCard
                        )
                    }
                }
                .frame(minWidth: 300)
        } detail: {
            if let card = pushedCard {
                CardDetailView(
                    card: card,
                    onUpdateTitle: { updateTitle(cardId: card.id, title: $0) }
                )
            } else {
                Text(verbatim: "—")
                    .foregroundStyle(Color.nudgeTextDim)
            }
        }
        .task(id: debouncedQuery) { await firstPage() }
        .task(id: query) { await debounceQuery() }
    }
    #endif

    // MARK: - Shared content

    @ViewBuilder
    private var content: some View {
        if cards.isEmpty && isLoading {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if cards.isEmpty && !debouncedQuery.isEmpty {
            emptyState(key: "cards.emptyWithQuery")
        } else if cards.isEmpty && hasError {
            emptyState(key: "error.unknown")
        } else if cards.isEmpty {
            emptyState(key: "cards.emptyNoCards")
        } else {
            list
        }
    }

    private func emptyState(key: LocalizedStringKey) -> some View {
        VStack {
            Spacer()
            Text(key, bundle: .module)
                .font(.subheadline)
                .foregroundStyle(Color.nudgeTextDim)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(cards) { card in
                    CardListItemView(card: card) {
                        openDetail(card)
                    }
                    .onAppear {
                        if card.id == cards.last?.id {
                            Task { await loadMore() }
                        }
                    }
                    Divider()
                        .background(Color.nudgeBorderLight)
                        .padding(.leading, 16)
                }
                if isLoadingMore {
                    Text("cards.loadMore", bundle: .module)
                        .font(.caption)
                        .foregroundStyle(Color.nudgeTextDim)
                        .padding(12)
                } else if nextCursor == nil && !cards.isEmpty {
                    Text("cards.noMore", bundle: .module)
                        .font(.caption)
                        .foregroundStyle(Color.nudgeTextDim)
                        .padding(12)
                }
            }
        }
    }

    // MARK: - Navigation

    private func openDetail(_ card: CardDTO) {
        #if os(iOS)
        navigationPath.append(card)
        #else
        pushedCard = card
        #endif
    }

    // MARK: - Data

    private func debounceQuery() async {
        try? await Task.sleep(nanoseconds: 300_000_000)
        if !Task.isCancelled {
            debouncedQuery = query
        }
    }

    private func firstPage() async {
        isLoading = true
        hasError = false
        do {
            let result = try await cardRepo.list(query: debouncedQuery, cursor: nil)
            cards = result.cards
            nextCursor = result.nextCursor
        } catch {
            print("[CardsHostView] firstPage failed: \(error)")
            cards = []
            hasError = true
        }
        isLoading = false
    }

    private func loadMore() async {
        guard !isLoadingMore, let cursor = nextCursor else { return }
        isLoadingMore = true
        do {
            let result = try await cardRepo.list(query: debouncedQuery, cursor: cursor)
            cards.append(contentsOf: result.cards)
            nextCursor = result.nextCursor
        } catch {
            print("[CardsHostView] loadMore failed: \(error)")
        }
        isLoadingMore = false
    }

    private func createCard() {
        Task {
            do {
                let card = try await cardRepo.create()
                openDetail(card)
                // Pull the new card to the top of the list.
                cards.insert(card, at: 0)
            } catch {
                print("[CardsHostView] create failed: \(error)")
            }
        }
    }

    // MARK: - Title update

    private func updateTitle(cardId: String, title: String) {
        // Optimistic: patch local list so the row reflects new title.
        if let idx = cards.firstIndex(where: { $0.id == cardId }) {
            let c = cards[idx]
            cards[idx] = CardDTO(
                id: c.id,
                title: title,
                description: c.description,
                updatedAt: c.updatedAt,
                tags: c.tags
            )
        }

        Task {
            do {
                try await cardRepo.updateTitle(cardId: cardId, title: title)
            } catch {
                print("[CardsHostView] updateTitle failed: \(error)")
            }
        }
    }
}
```

**Note:** `cardRepo.updateTitle` is added in Task 9. The file won't compile until both tasks are in place — that's the handoff pattern used through this plan block.

- [ ] **Step 2: Build 驗 — expect fail because CardRepository.updateTitle doesn't exist yet**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build 2>&1 | tail -3
```
Expected: compile error referencing `cardRepo.updateTitle`. That's the bridge to Task 9.

---

### Task 9: CardRepository.updateTitle extension

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeCore/CardRepository.swift`

- [ ] **Step 1: 加 updateTitle method**

Append inside the `CardRepository` class (before the closing `}`):

```swift
    public func updateTitle(cardId: String, title: String) async throws {
        struct Body: Codable { let title: String }
        try await client.patchVoid("/api/tasks/\(cardId)", body: Body(title: title))
    }
```

- [ ] **Step 2: Build — now Task 8 should compile**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build 2>&1 | tail -3
```
Expected: Build complete.

- [ ] **Step 3: Commit Tasks 8 + 9 together**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/Cards/CardsHostView.swift \
        apple/NudgeKit/Sources/NudgeCore/CardRepository.swift
git commit -m "$(cat <<'EOF'
feat(ui): CardsHostView — list + search + load more + create + title patch

Host view for the cards feed, handles:
- First-page fetch on debounced query change (.task(id: debouncedQuery))
- Query debounce 300ms via .task(id: query) + Task.sleep
- Cursor pagination: last-row .onAppear triggers loadMore; guarded on
  isLoadingMore + nextCursor
- Empty states: loading spinner / "no matches" / "nothing written yet" /
  error.unknown
- Create button: + toolbar item; POSTs empty, pushes detail, inserts
  at top of list
- Title update: optimistic local update + PATCH /api/tasks/{id}

iOS uses NavigationStack + navigationDestination(for: CardDTO.self).
macOS uses NavigationSplitView with sidebar list + detail pane pinned
to pushedCard state (300pt min width).

CardRepository.updateTitle(cardId:title:) added so the host doesn't
import PATCH plumbing of its own.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block F：Platform integration

### Task 10: Wire CardsHostView into PlatformRootView

**Files:**
- Modify: `apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift`

替換 iOS tab 與 macOS sidebar `.cards` case 的 placeholder。

- [ ] **Step 1: Read current file**

```bash
cat /Users/mike/Documents/nudge/apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift
```

Find the iOS tab for cards (`Text("nav.cards"...)` + `PlaceholderTab(title: "卡片", ...)` in the `TabView` block) and the macOS `case .cards:` inside the sidebar switch.

- [ ] **Step 2: iOS tab replacement**

Change:
```swift
PlaceholderTab(title: "卡片", systemImage: "square.stack")
    .tabItem { Label { Text("nav.cards", bundle: .module) } icon: { Image(systemName: "square.stack") } }
```
to:
```swift
CardsHostView()
    .tabItem { Label { Text("nav.cards", bundle: .module) } icon: { Image(systemName: "square.stack") } }
```

- [ ] **Step 3: macOS sidebar replacement**

Change:
```swift
case .cards: PlaceholderTab(title: "卡片", systemImage: "square.stack")
```
to:
```swift
case .cards: CardsHostView()
```

- [ ] **Step 4: Build**

```bash
cd /Users/mike/Documents/nudge/apple/NudgeKit
swift build 2>&1 | tail -3
```
Expected: Build complete.

- [ ] **Step 5: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/NudgeKit/Sources/NudgeUI/PlatformRootView.swift
git commit -m "$(cat <<'EOF'
feat(ui): wire CardsHostView into 卡片 tab / sidebar

iOS TabView: 卡片 tabItem now renders CardsHostView instead of
PlaceholderTab. macOS sidebar: .cards case renders CardsHostView.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Inject CardRepository from app entries

**Files:**
- Modify: `apple/Nudge-iOS/NudgeiOSApp.swift`
- Modify: `apple/Nudge-macOS/NudgeMacApp.swift`

- [ ] **Step 1: iOS App**

In `NudgeiOSApp.swift`:

Add `@State private var cardRepo: CardRepository` near the other `@State` repos.

In `init()`, after `let calRepo = CalendarRepository(client: client)`:
```swift
let cardRepo = CardRepository(client: client)
```

Add `self._cardRepo = State(initialValue: cardRepo)` near the other State assignments.

In `body`, add `.environment(cardRepo)` after the other `.environment` chain:
```swift
PlatformRootView(auth: auth)
    .environment(taskRepo)
    .environment(tagRepo)
    .environment(calendarRepo)
    .environment(cardRepo)
```

- [ ] **Step 2: macOS App**

Same changes in `NudgeMacApp.swift`.

- [ ] **Step 3: Xcode build verify**

```bash
cd /Users/mike/Documents/nudge/apple
xcodebuild -project Nudge.xcodeproj -scheme Nudge-iOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -configuration Debug build 2>&1 | grep -E "error:|BUILD SUCCEEDED|FAILED" | head -3
```
Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 4: Commit**

```bash
cd /Users/mike/Documents/nudge
git add apple/Nudge-iOS/NudgeiOSApp.swift apple/Nudge-macOS/NudgeMacApp.swift
git commit -m "$(cat <<'EOF'
feat(app): inject CardRepository from iOS + macOS app entries

Constructed alongside existing repos (same APIClient + 401 handler
wiring inherited). Passed into PlatformRootView as a fifth
.environment(...) so CardsHostView's @Environment(CardRepository.self)
resolves.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

# Block G：Manual verification

### Task 12: Manual DoD checklist (iOS + macOS)

**Files:** 無 code change。對照 Phase 4 spec DoD 手動走過。

- [ ] **Step 1: iOS 模擬器驗收**

Launch iPhone 17 Pro simulator, run app.

1. 登入 → 點底部 tab「卡片」
2. 列表載入（有 skeleton / loading）→ 看得到 cards
3. 搜尋框打字 → 300ms 後列表過濾
4. 清空搜尋 → 恢復原列表
5. 滾到列表底部 → 自動 loadMore
6. 點一張卡 → push 進 detail
7. 改標題 → 500ms 後 Console 應該看到 `[APIClient] PATCH .../api/tasks/{id} -> 200`
8. 按 back → 列表該 row 標題已更新
9. 按右上 `+` → 導向空白 detail，標題自動 focus
10. 打個標題 → back → 列表第一張就是新建的

- [ ] **Step 2: macOS 驗收**

Launch Mac app (Xcode ⌘R on Nudge-macOS scheme).

1. Sidebar 看得到「卡片」
2. 點進去 → 左 list、右空態
3. 列表、搜尋、loadMore、detail 右邊 pane 顯示與 iOS 行為一致
4. `+` toolbar 可新增

- [ ] **Step 3: 若全綠，empty commit 封印**

```bash
cd /Users/mike/Documents/nudge
git commit --allow-empty -m "$(cat <<'EOF'
chore(apple): Phase 4 manual verification passed

Verified on:
- iOS iPhone 17 Pro simulator
- macOS host

Covered: list / search / load more / detail push / title edit +
debounced PATCH / create new card + auto-focus. Three-way i18n
(zh-Hant/en/ja) sanity-checked on at least one locale switch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

若有 bug，回到對應 Task 修好再重跑本 block。

---

## Phase 4 Definition of Done

- `swift test --no-parallel` 全綠（新增 13 tests：6 StringHTML + 4 CardDTO + 3 CardRepository）
- `xcodebuild -scheme Nudge-iOS` 綠
- iOS + macOS 兩端 Task 12 checklist 全走過
- pre-commit lint（scripts/lint-swift-tokens.sh）不擋
- i18n: 三語切換 UI 正確（xcstrings 鏡像 9 個 Web key、無新 key 被發明）
- 無 SwiftData cache 寫入（Cards 是 network-first，沒必要入 cache）

## 後續

Phase 4 完後可選下一步：
- **Phase 4b：rich-text 編輯** — WKWebView + Quill/Tiptap bridge（最費工）
- **Phase 5：tag CRUD + archive** — 補 create/update/delete tag、archive 卡片
- **Phase 3：notes (日誌)** — 每日筆記，同樣會面臨 rich-text 問題
