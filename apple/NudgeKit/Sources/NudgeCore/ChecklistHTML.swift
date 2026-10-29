import Foundation

// 任務內文待辦項目的解析／改寫 —— 與 Web `src/lib/checklist.ts` 鏡像。
// 改一邊，兩邊測試都要過（共吃 `src/lib/checklist-cases.json`）。
// 兩種 HTML 都吃：編輯器的 <label><input> 版、onboarding 的無 input 版、屬性
// 順序無關。改勾選時 data-checked 一定改，有 <input> 才連 checked 一起改。

public struct ChecklistItem: Equatable, Sendable {
    public let text: String
    public let checked: Bool
    public init(text: String, checked: Bool) {
        self.text = text
        self.checked = checked
    }
}

public enum ChecklistEdit: Equatable, Sendable {
    case toggle(index: Int, text: String, checked: Bool)
    case append(text: String)
    case remove(index: Int, text: String)
    case setText(index: Int, text: String, newText: String)
    case move(from: Int, to: Int, text: String)
    case checkAll
}

public enum ChecklistTransition: Equatable, Sendable {
    case becameAllChecked
    case leftAllChecked
    case none
}

public enum ChecklistHTML {

    // MARK: Public API

    public static func parse(_ html: String?) -> [ChecklistItem] {
        guard let html, !html.isEmpty else { return [] }
        return blocks(in: html).map {
            ChecklistItem(text: itemText($0.inner), checked: isChecked($0.open))
        }
    }

    public static func isAllChecked(_ items: [ChecklistItem]) -> Bool {
        !items.isEmpty && items.allSatisfy(\.checked)
    }

    public static func apply(_ edit: ChecklistEdit, to html: String?) -> String? {
        let src = html ?? ""
        switch edit {
        case .append(let rawText):
            let text = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty { return nil }
            let li = newItemHTML(text)
            let items = blocks(in: src)
            guard let last = items.last else {
                return src + "<ul data-type=\"taskList\">" + li + "</ul>"
            }
            let ns = src as NSString
            let end = last.range.location + last.range.length
            return ns.substring(to: end) + li + ns.substring(from: end)

        case .checkAll:
            let items = blocks(in: src)
            if items.isEmpty { return src }
            var out = src
            // 從後往前改，前面區塊的位移才不會失效。
            for b in items.reversed() where !isChecked(b.open) {
                let replaced = setChecked(b.full, true)
                out = (out as NSString).replacingCharacters(in: b.range, with: replaced)
            }
            return out

        case .toggle(let index, let text, let checked):
            let items = blocks(in: src)
            if index < 0 || index >= items.count { return nil }
            let b = items[index]
            if itemText(b.inner) != text { return nil }
            if isChecked(b.open) == checked { return src }
            let replaced = setChecked(b.full, checked)
            return (src as NSString).replacingCharacters(in: b.range, with: replaced)

        case .remove(let index, let text):
            let items = blocks(in: src)
            if index < 0 || index >= items.count { return nil }
            let b = items[index]
            if itemText(b.inner) != text { return nil }
            var out = (src as NSString).replacingCharacters(in: b.range, with: "")
            // 刪光後留下的空 taskList <ul></ul> 一併清掉。
            out = replace(out, "<ul\\b[^>]*data-type=\"taskList\"[^>]*>\\s*</ul>",
                          with: "", [.caseInsensitive])
            return out

        case .setText(let index, let text, let rawNew):
            let newText = rawNew.trimmingCharacters(in: .whitespacesAndNewlines)
            if newText.isEmpty { return nil }
            let items = blocks(in: src)
            if index < 0 || index >= items.count { return nil }
            let b = items[index]
            if itemText(b.inner) != text { return nil }
            if itemText(b.inner) == newText { return src }
            guard let replaced = setText(b.full, newText) else { return nil }
            return (src as NSString).replacingCharacters(in: b.range, with: replaced)

        case .move(let from, let to, let text):
            let items = blocks(in: src)
            let n = items.count
            if from < 0 || from >= n || to < 0 || to >= n { return nil }
            if from == to { return src }
            if itemText(items[from].inner) != text { return nil }
            let ns = src as NSString
            // taskItem 之間只能是空白（換行/縮排不影響渲染），否則放棄。
            for i in 0..<(n - 1) {
                let endI = items[i].range.location + items[i].range.length
                let startNext = items[i + 1].range.location
                let between = ns.substring(with: NSRange(location: endI, length: startNext - endI))
                if !between.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return nil }
            }
            var fulls = items.map { $0.full }
            let moved = fulls.remove(at: from)
            fulls.insert(moved, at: to)
            let regionStart = items[0].range.location
            let lastEnd = items[n - 1].range.location + items[n - 1].range.length
            return ns.substring(to: regionStart) + fulls.joined() + ns.substring(from: lastEnd)
        }
    }

    public static func transition(before: String?, after: String?) -> ChecklistTransition {
        let b = parse(before)
        let a = parse(after)
        let beforeAll = isAllChecked(b)
        let afterAll = isAllChecked(a)
        if !beforeAll && afterAll { return .becameAllChecked }
        if beforeAll && !afterAll,
           a.filter(\.checked).count < b.filter(\.checked).count {
            return .leftAllChecked
        }
        return .none
    }

    // MARK: Internals

    private struct Block {
        let range: NSRange
        let open: String
        let inner: String
        let full: String
    }

    private static func blocks(in html: String) -> [Block] {
        let ns = html as NSString
        let re = regex("<li\\b([^>]*)>(.*?)</li>", [.caseInsensitive, .dotMatchesLineSeparators])
        var out: [Block] = []
        for m in re.matches(in: html, range: NSRange(location: 0, length: ns.length)) {
            let open = ns.substring(with: m.range(at: 1))
            guard matches(open, "\\bdata-type=\"taskItem\"") else { continue }
            out.append(
                Block(
                    range: m.range,
                    open: open,
                    inner: ns.substring(with: m.range(at: 2)),
                    full: ns.substring(with: m.range)
                )
            )
        }
        return out
    }

    private static func isChecked(_ open: String) -> Bool {
        matches(open, "\\bdata-checked=\"true\"")
    }

    private static func itemText(_ inner: String) -> String {
        var s = replace(inner, "<label\\b[^>]*>.*?</label>", with: "",
                        [.caseInsensitive, .dotMatchesLineSeparators])
        s = replace(s, "<[^>]+>", with: "")
        s = decodeEntities(s)
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func setChecked(_ full: String, _ checked: Bool) -> String {
        var out = replace(full, "(\\bdata-checked=\")(?:true|false)(\")",
                          with: "$1\(checked ? "true" : "false")$2", [.caseInsensitive])
        if matches(out, "<input\\b[^>]*type=\"checkbox\"") {
            if checked {
                if !matches(out, "<input\\b[^>]*\\bchecked=") {
                    out = replace(out, "(<input\\b[^>]*type=\"checkbox\")([^>]*>)",
                                  with: "$1 checked=\"checked\"$2", [.caseInsensitive])
                }
            } else {
                out = replace(out, "(<input\\b[^>]*type=\"checkbox\")\\s+checked=\"checked\"([^>]*>)",
                              with: "$1$2", [.caseInsensitive])
            }
        }
        return out
    }

    // 只換 taskItem 內第一個 <p>…</p> 的文字，其餘結構原封不動。
    private static func setText(_ full: String, _ newText: String) -> String? {
        if !matches(full, "<p\\b[^>]*>") { return nil }
        // 插入文字要先當成「字面」escape，避免 $ / \ 被當成 regex 模板特殊字元。
        let safe = NSRegularExpression.escapedTemplate(for: escapeHTML(newText))
        return replace(full, "(<p\\b[^>]*>).*?(</p>)", with: "$1" + safe + "$2",
                       [.caseInsensitive, .dotMatchesLineSeparators])
    }

    private static func newItemHTML(_ text: String) -> String {
        "<li data-checked=\"false\" data-type=\"taskItem\"><label><input type=\"checkbox\"><span></span></label><div><p>"
            + escapeHTML(text) + "</p></div></li>"
    }

    private static func decodeEntities(_ s: String) -> String {
        var r = s
        r = r.replacingOccurrences(of: "&lt;", with: "<", options: .caseInsensitive)
        r = r.replacingOccurrences(of: "&gt;", with: ">", options: .caseInsensitive)
        r = r.replacingOccurrences(of: "&quot;", with: "\"", options: .caseInsensitive)
        r = r.replacingOccurrences(of: "&#39;", with: "'")
        r = r.replacingOccurrences(of: "&nbsp;", with: " ", options: .caseInsensitive)
        r = r.replacingOccurrences(of: "&amp;", with: "&", options: .caseInsensitive)
        return r
    }

    private static func escapeHTML(_ s: String) -> String {
        var r = s
        r = r.replacingOccurrences(of: "&", with: "&amp;")
        r = r.replacingOccurrences(of: "<", with: "&lt;")
        r = r.replacingOccurrences(of: ">", with: "&gt;")
        r = r.replacingOccurrences(of: "\"", with: "&quot;")
        return r
    }

    // MARK: Regex helpers

    private static func regex(_ pattern: String, _ options: NSRegularExpression.Options = []) -> NSRegularExpression {
        // swiftlint:disable:next force_try
        try! NSRegularExpression(pattern: pattern, options: options)
    }

    private static func matches(_ s: String, _ pattern: String,
                                _ options: NSRegularExpression.Options = [.caseInsensitive]) -> Bool {
        let ns = s as NSString
        return regex(pattern, options)
            .firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) != nil
    }

    private static func replace(_ s: String, _ pattern: String, with template: String,
                                _ options: NSRegularExpression.Options = []) -> String {
        let ns = s as NSString
        return regex(pattern, options)
            .stringByReplacingMatches(in: s, range: NSRange(location: 0, length: ns.length),
                                      withTemplate: template)
    }
}
