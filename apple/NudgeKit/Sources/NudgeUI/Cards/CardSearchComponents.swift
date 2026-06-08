import SwiftUI
import NudgeCore

/// 共用卡片搜尋輸入框。視覺/行為抽自 `DailyHostView` 的 dashboard cards
/// 搜尋面板 —— macOS Cards tab 與 Daily 右側 dashboard 共用同一份，避免
/// 在同一個 app 裡出現兩種卡片搜尋外觀。
///
/// 純展示：query 綁定與 focus 由呼叫端持有；容器外距 / auto-focus 等
/// 行為留在呼叫端（Daily 展開時要 auto-focus、Cards tab 常駐不需要）。
struct CardSearchField: View {
    @Binding var query: String
    var isFocused: FocusState<Bool>.Binding
    let placeholderKey: LocalizedStringKey

    init(
        query: Binding<String>,
        isFocused: FocusState<Bool>.Binding,
        placeholderKey: LocalizedStringKey = "cards.searchPlaceholder"
    ) {
        self._query = query
        self.isFocused = isFocused
        self.placeholderKey = placeholderKey
    }

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .nudgeFont(.fieldIcon)
                .foregroundStyle(Color.nudgeTextDim)
            TextField("", text: $query, prompt: Text(placeholderKey, bundle: .module))
                .textFieldStyle(.plain)
                .nudgeFont(.fieldText)
                .foregroundStyle(Color.nudgeForeground)
                .tint(Color.nudgePrimary)
                .focused(isFocused)
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .nudgeFont(.fieldIcon)
                        .foregroundStyle(Color.nudgeTextDim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.nudgeForeground.opacity(0.06))
        )
    }
}

/// 共用 tag 多選 chips（`FlowLayout` 折行，capsule，active = `nudgePrimary`）。
/// 視覺抽自 `DailyHostView.dashboardCardsTagChips`。容器外距留呼叫端。
struct CardTagChips: View {
    let allTags: [TagDTO]
    @Binding var selectedTagIds: Set<String>

    init(allTags: [TagDTO], selectedTagIds: Binding<Set<String>>) {
        self.allTags = allTags
        self._selectedTagIds = selectedTagIds
    }

    var body: some View {
        FlowLayout(spacing: 6, lineSpacing: 10) {
            ForEach(allTags) { tag in
                let active = selectedTagIds.contains(tag.id)
                Button {
                    if active {
                        selectedTagIds.remove(tag.id)
                    } else {
                        selectedTagIds.insert(tag.id)
                    }
                } label: {
                    Text(verbatim: tag.name)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(active ? Color.nudgePrimaryForeground : Color.nudgeForeground)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(active ? Color.nudgePrimary : Color.nudgeForeground.opacity(0.06))
                        )
                }
                .buttonStyle(.plain)
            }
            if !selectedTagIds.isEmpty {
                Button { selectedTagIds.removeAll() } label: {
                    HStack(spacing: 3) {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .medium))
                        Text("common.clear", bundle: .module)
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundStyle(Color.nudgePrimary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
            }
        }
    }
}
