import Testing
import Foundation
@testable import NudgeCore

// 與 Web `src/lib/checklist.test.ts` 共吃 `src/lib/checklist-cases.json`。
// 改 checklist 邏輯，兩邊測試都要過。

@Suite("ChecklistHTML") struct ChecklistHTMLTests {

    struct Cases: Decodable {
        struct ItemJSON: Decodable { let text: String; let checked: Bool }
        struct ParseCase: Decodable { let name: String; let html: String?; let items: [ItemJSON] }
        struct EditJSON: Decodable {
            let kind: String
            let index: Int?
            let text: String?
            let checked: Bool?
            let newText: String?
            let from: Int?
            let to: Int?
        }
        struct EditCase: Decodable { let name: String; let html: String?; let edit: EditJSON; let expected: String? }
        struct TransitionCase: Decodable { let name: String; let before: String?; let after: String?; let expected: String }
        let parse: [ParseCase]
        let edit: [EditCase]
        let transition: [TransitionCase]
    }

    static let cases: Cases = {
        // 測試檔 → repo root（往上 4 層目錄）→ src/lib/checklist-cases.json
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 { url.deleteLastPathComponent() }
        url.appendPathComponent("src/lib/checklist-cases.json")
        let data = try! Data(contentsOf: url)
        return try! JSONDecoder().decode(Cases.self, from: data)
    }()

    @Test func parseMatchesFixture() {
        for c in Self.cases.parse {
            let got = ChecklistHTML.parse(c.html)
            let expected = c.items.map { ChecklistItem(text: $0.text, checked: $0.checked) }
            #expect(got == expected, "parse: \(c.name)")
        }
    }

    @Test func applyEditMatchesFixture() {
        for c in Self.cases.edit {
            let edit: ChecklistEdit
            switch c.edit.kind {
            case "toggle":
                edit = .toggle(index: c.edit.index!, text: c.edit.text!, checked: c.edit.checked!)
            case "append":
                edit = .append(text: c.edit.text!)
            case "remove":
                edit = .remove(index: c.edit.index!, text: c.edit.text!)
            case "setText":
                edit = .setText(index: c.edit.index!, text: c.edit.text!, newText: c.edit.newText!)
            case "move":
                edit = .move(from: c.edit.from!, to: c.edit.to!, text: c.edit.text!)
            case "checkAll":
                edit = .checkAll
            default:
                Issue.record("unknown edit kind: \(c.edit.kind)")
                continue
            }
            #expect(ChecklistHTML.apply(edit, to: c.html) == c.expected, "edit: \(c.name)")
        }
    }

    @Test func transitionMatchesFixture() {
        for c in Self.cases.transition {
            let expected: ChecklistTransition
            switch c.expected {
            case "became-all-checked": expected = .becameAllChecked
            case "left-all-checked": expected = .leftAllChecked
            default: expected = .none
            }
            #expect(ChecklistHTML.transition(before: c.before, after: c.after) == expected, "transition: \(c.name)")
        }
    }
}
