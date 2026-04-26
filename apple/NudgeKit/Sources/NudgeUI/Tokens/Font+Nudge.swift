import SwiftUI

/// Nudge typography tokens — 平台分支字級 + 全域可調整 scale。
///
/// **動機 1（平台）**：SwiftUI semantic font (`.caption` / `.subheadline`...)
/// 在 mac 上比 iOS 小 2-5pt（mac `.caption` ≈ 10pt vs iOS 12pt）。直接共用
/// 同一個 semantic font，mac 端會莫名奇妙地偏小。所有 token 內部
/// `#if os(macOS)` 用 explicit pt 拉到桌機閱讀友善的範圍（12-17pt），
/// iOS 維持原本 semantic font。
///
/// **動機 2（縮放）**：使用者用 ⌘+ / ⌘- 調整字級時（透過 `.nudgeFont`
/// modifier 讀 environment 裡的 scale），整頁字一起放大/縮小，layout
/// 自動 reflow（不像 .scaleEffect 會破壞排版）。
///
/// **使用方式**：
/// - 一般使用：`Text(...).nudgeFont(.columnTitle)` ← 受 ⌘+/- 影響
/// - 不想被縮放（極少數例外）：`Text(...).font(.nudgeColumnTitle)`
///   ← 永遠 1.0 scale
public enum NudgeFontToken: Hashable, Sendable {
    case columnTitle
    case columnTitleAccessory
    case sectionHeader
    case sectionChevron
    case rowTitle
    case rowTitleEmphasized
    case primaryRowTitle
    case rowBody
    case rowMeta
    case rowMetaEmphasized
    case fieldText
    case fieldIcon
    case chipLabel
    case inlineButtonLabel
    case emptyStateBody
    case errorMeta
    case columnDetailTitle
    case weekdayLabel
    case weekdayNumber

    /// scale 通常從 `EnvironmentValues.nudgeFontScale` 取得（透過
    /// `.nudgeFont(_:)` modifier）。clamping 在 modifier 那層做。
    public func font(scale: CGFloat = 1.0) -> Font {
        switch self {
        case .columnTitle:
            #if os(macOS)
            return .system(size: 15 * scale, weight: .semibold)
            #else
            return .title3.weight(.semibold)
            #endif

        case .columnTitleAccessory:
            #if os(macOS)
            return .system(size: 12 * scale, weight: .medium)
            #else
            return .footnote.weight(.medium)
            #endif

        case .sectionHeader:
            #if os(macOS)
            return .system(size: 14 * scale, weight: .semibold)
            #else
            return .subheadline.weight(.semibold)
            #endif

        case .sectionChevron:
            #if os(macOS)
            return .system(size: 13 * scale, weight: .semibold)
            #else
            return .caption.weight(.semibold)
            #endif

        case .rowTitle:
            #if os(macOS)
            return .system(size: 13 * scale)
            #else
            return .body
            #endif

        case .rowTitleEmphasized:
            #if os(macOS)
            return .system(size: 13 * scale, weight: .semibold)
            #else
            return .body.weight(.semibold)
            #endif

        case .primaryRowTitle:
            #if os(macOS)
            return .system(size: 14 * scale)
            #else
            return .body
            #endif

        case .rowBody:
            #if os(macOS)
            return .system(size: 12 * scale)
            #else
            return .subheadline
            #endif

        case .rowMeta:
            #if os(macOS)
            return .system(size: 12 * scale, weight: .medium)
            #else
            return .caption.weight(.medium)
            #endif

        case .rowMetaEmphasized:
            #if os(macOS)
            return .system(size: 12 * scale, weight: .semibold)
            #else
            return .caption.weight(.semibold)
            #endif

        case .fieldText:
            #if os(macOS)
            return .system(size: 13 * scale)
            #else
            return .body
            #endif

        case .fieldIcon:
            #if os(macOS)
            return .system(size: 12 * scale)
            #else
            return .caption
            #endif

        case .chipLabel:
            #if os(macOS)
            return .system(size: 11 * scale, weight: .medium)
            #else
            return .caption2.weight(.medium)
            #endif

        case .inlineButtonLabel:
            #if os(macOS)
            return .system(size: 13 * scale, weight: .semibold)
            #else
            return .caption.weight(.semibold)
            #endif

        case .emptyStateBody:
            #if os(macOS)
            return .system(size: 13 * scale)
            #else
            return .subheadline
            #endif

        case .errorMeta:
            #if os(macOS)
            return .system(size: 12 * scale, weight: .medium)
            #else
            return .caption2.weight(.medium)
            #endif

        case .columnDetailTitle:
            #if os(macOS)
            return .system(size: 17 * scale, weight: .semibold)
            #else
            return .title3.weight(.semibold)
            #endif

        case .weekdayLabel:
            #if os(macOS)
            return .system(size: 11 * scale, weight: .medium)
            #else
            return .caption2
            #endif

        case .weekdayNumber:
            #if os(macOS)
            return .system(size: 16 * scale, weight: .semibold)
            #else
            return .headline
            #endif
        }
    }
}

// MARK: - Backwards-compat static vars
//
// 既有 callers（沒換成 .nudgeFont(...) modifier）會走 1.0 scale，不受
// ⌘+/- 影響。新 / 想要可縮放的 callers 改用 `.nudgeFont(.token)`。

public extension Font {
    static var nudgeColumnTitle: Font { NudgeFontToken.columnTitle.font() }
    static var nudgeColumnTitleAccessory: Font { NudgeFontToken.columnTitleAccessory.font() }
    static var nudgeSectionHeader: Font { NudgeFontToken.sectionHeader.font() }
    static var nudgeSectionChevron: Font { NudgeFontToken.sectionChevron.font() }
    static var nudgeRowTitle: Font { NudgeFontToken.rowTitle.font() }
    static var nudgeRowTitleEmphasized: Font { NudgeFontToken.rowTitleEmphasized.font() }
    static var nudgePrimaryRowTitle: Font { NudgeFontToken.primaryRowTitle.font() }
    static var nudgeRowBody: Font { NudgeFontToken.rowBody.font() }
    static var nudgeRowMeta: Font { NudgeFontToken.rowMeta.font() }
    static var nudgeRowMetaEmphasized: Font { NudgeFontToken.rowMetaEmphasized.font() }
    static var nudgeFieldText: Font { NudgeFontToken.fieldText.font() }
    static var nudgeFieldIcon: Font { NudgeFontToken.fieldIcon.font() }
    static var nudgeChipLabel: Font { NudgeFontToken.chipLabel.font() }
    static var nudgeInlineButtonLabel: Font { NudgeFontToken.inlineButtonLabel.font() }
    static var nudgeEmptyStateBody: Font { NudgeFontToken.emptyStateBody.font() }
    static var nudgeErrorMeta: Font { NudgeFontToken.errorMeta.font() }
    static var nudgeColumnDetailTitle: Font { NudgeFontToken.columnDetailTitle.font() }
    static var nudgeWeekdayLabel: Font { NudgeFontToken.weekdayLabel.font() }
    static var nudgeWeekdayNumber: Font { NudgeFontToken.weekdayNumber.font() }
}

// MARK: - Environment scale

private struct NudgeFontScaleKey: EnvironmentKey {
    static let defaultValue: CGFloat = 1.0
}

public extension EnvironmentValues {
    /// 全域字級倍率 — 由 NudgeMacApp 從 `@AppStorage("nudgeFontScale")`
    /// 注入。`.nudgeFont(_:)` modifier 會吃這個 value 縮放字級。
    /// Range：0.8 - 1.4（0.7 太小、1.5 太大），由 NudgeMacApp clamp。
    var nudgeFontScale: CGFloat {
        get { self[NudgeFontScaleKey.self] }
        set { self[NudgeFontScaleKey.self] = newValue }
    }
}

// MARK: - Modifier

private struct NudgeFontModifier: ViewModifier {
    @Environment(\.nudgeFontScale) private var scale
    let token: NudgeFontToken

    func body(content: Content) -> some View {
        content.font(token.font(scale: scale))
    }
}

public extension View {
    /// 用 token + 全域 scale 套字級。受 ⌘+ / ⌘- 影響。比 `.font(.nudgeXxx)`
    /// 多一層 env 讀取，但 SwiftUI 會幫忙做 dependency tracking、scale 改
    /// 變時自動 invalidate body。
    func nudgeFont(_ token: NudgeFontToken) -> some View {
        modifier(NudgeFontModifier(token: token))
    }
}

// MARK: - Notification names for ⌘+/-/0
//
// `NudgeCommands` 是 mac-only enum（CommandNotifications.swift），這
// 整段也需要 guard。

#if os(macOS)
public extension NudgeCommands {
    static let zoomInNotification = Notification.Name("nudge.zoomIn")
    static let zoomOutNotification = Notification.Name("nudge.zoomOut")
    static let zoomResetNotification = Notification.Name("nudge.zoomReset")
}
#endif
