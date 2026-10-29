import SwiftUI
import NudgeCore
#if os(macOS)
import AppKit
#endif

// 任務列上的子項目 UI —— 鏡像 Web `src/components/task/task-checklist.tsx`。
// 子項目資料從 task.description 的 taskItem 推導；改寫（勾/新增/刪/改字/搬移）都
// 往上拋 onChecklistEdit，實際存檔與母子同步在 DailyHostView。
// 勾選框、字級一律與母任務一致（對齊現行 Web：子項目不縮小）。

/// 進度膠囊 —— 只有展開/收合箭頭（對齊現行 Web：拿掉 2/5 數字）。全勾時轉主色。
struct TaskChecklistPill: View {
    let collapsed: Bool
    let allDone: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            Image(systemName: collapsed ? "chevron.right" : "chevron.down")
                .nudgeFont(.sectionChevron)
                .foregroundStyle(allDone ? Color.nudgePrimary : Color.nudgeTextDim)
                .frame(minWidth: 28, minHeight: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            Text(collapsed ? "task.checklist.expand" : "task.checklist.collapse", bundle: .module)
        )
    }
}

/// 子項目列表。縮排對齊母任務標題。每一列滑過時給自己一塊區塊底 + ✕ 刪除。
struct TaskChecklistBody: View {
    let items: [ChecklistItem]
    let onToggle: (Int) -> Void
    let onRemove: (Int) -> Void
    let onSetText: (Int, String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                ChecklistSubRow(
                    item: item,
                    onToggle: { onToggle(index) },
                    onRemove: { onRemove(index) },
                    onSetText: { newText in onSetText(index, newText) }
                )
            }
        }
        // 對齊母任務標題左緣（母任務 checkbox 44 寬 + spacing 8）。
        .padding(.leading, 52)
    }
}

/// 單一子項目列 —— 自帶 hover：滑過時浮出自己的區塊底 + ✕ 刪除鈕，
/// 讓人知道正在哪一個子項目上（鏡像 Web 的子項目 hover 區塊）。
/// ✕ 與區塊右緣都對齊母任務列的「收合箭頭膠囊」那一欄：
/// 膠囊中心離內容右緣 58pt（選單 36 + 間距 8 + 半膠囊 14），在區塊外側保留 38pt，
/// ✕ 常駐佔位（opacity 切換）讓文字寬度不隨 hover 跳動。
private struct ChecklistSubRow: View {
    let item: ChecklistItem
    let onToggle: () -> Void
    let onRemove: () -> Void
    let onSetText: (String) -> Void

    @Environment(\.locale) private var locale
    @State private var isHovered = false
    @State private var editing = false
    @State private var draft = ""

    // 送出一次（Enter 與失焦都會呼叫，用 editing guard 擋掉第二次）。
    private func commit() {
        guard editing else { return }
        editing = false
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty, trimmed != item.text {
            onSetText(trimmed)
        }
    }

    private var trailingReserve: CGFloat {
        #if os(macOS)
        // mac 母任務列尾＝日曆(36)+間距12+⋯(36)+間距8+膠囊(28)，膠囊中心離右緣 106；
        // 保留 86 = 106 − 區塊右內距 6 − 半 ✕ 14，讓 ✕ 中心對齊膠囊。
        return 86
        #else
        return 46   // iOS 列尾只有 ⋯(44)+膠囊(28)，膠囊中心離右緣 66
        #endif
    }

    var body: some View {
        HStack(spacing: 8) {
            NudgeCheckbox(
                isChecked: item.checked,
                accessibilityLabel: item.checked ? "task.uncomplete" : "task.complete",
                size: 28,
                action: onToggle
            )

            if editing {
                InlineRowTextField(text: $draft, onCommit: commit)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Text(item.text)
                    .nudgeFont(.primaryRowTitle)
                    .strikethrough(item.checked)
                    .foregroundStyle(item.checked ? Color.nudgeTextDim : Color.nudgeForeground)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    // 點文字 → 行內改字（不影響母任務列的點擊/popover）。
                    .onTapGesture {
                        draft = item.text
                        editing = true
                    }
                    #if os(macOS)
                    // 滑過文字 → 游標變文字編輯游標（I-beam），提示可點進去改字。
                    .onHover { inside in
                        if inside { NSCursor.iBeam.push() } else { NSCursor.pop() }
                    }
                    #endif
            }

            // ✕ 刪除 —— 常駐佔位（28，對齊膠囊），滑過才顯示 + 可點。
            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isHovered ? Color.nudgePrimary : Color.nudgeTextDim)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .opacity(isHovered ? 1 : 0)
            .allowsHitTesting(isHovered)
            .accessibilityLabel(Text(verbatim: String(
                format: nudgeLocalized("task.checklist.removeAria", locale: locale),
                item.text
            )))
        }
        .padding(.leading, 6)
        .padding(.trailing, 6)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(isHovered ? Color.nudgeForeground.opacity(0.08) : Color.clear)
        )
        // 區塊只到膠囊欄為止（保留在外側、不含底色）。
        .padding(.trailing, trailingReserve)
        .contentShape(Rectangle())
        .onHover { isHovered = $0 }
    }
}

/// 列內行內輸入框 —— 子項目/標題共用。mac 走 MacTitleTextField（caret/IME 吃主色、
/// 聚焦游標置尾不全選、Enter 與失焦都送出）；iOS 走原生 TextField。
struct InlineRowTextField: View {
    @Binding var text: String
    let onCommit: () -> Void

    // 編輯框字級要吃全域 ⌘+/− 倍率，和顯示文字（.nudgeFont(.primaryRowTitle)）一樣大。
    @Environment(\.nudgeFontScale) private var scale

    var body: some View {
        #if os(macOS)
        MacTitleTextField(
            text: $text,
            placeholder: "",
            fontSize: 14 * scale,
            fontWeight: .regular,
            autoFocus: true,
            onSubmit: onCommit,
            onEndEditing: onCommit
        )
        #else
        TextField("", text: $text)
            .textFieldStyle(.plain)
            .nudgeFont(.primaryRowTitle)
            .foregroundStyle(Color.nudgeForeground)
            .submitLabel(.done)
            .onSubmit(onCommit)
        #endif
    }
}
