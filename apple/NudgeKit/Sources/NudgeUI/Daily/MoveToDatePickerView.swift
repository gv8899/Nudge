import SwiftUI
import NudgeCore

/// 「移到其他日期」modal。
///
/// Calendar UI 走自刻 `LazyVGrid` 而非 SwiftUI 原生 `DatePicker(.graphical)`：
/// - 原生在 mac 上是 NSDatePicker wrap、intrinsic size ~250pt 寫死、`.frame`
///   套不上去；放大只能 `.scaleEffect()` 但文字會糊
/// - 自刻可任意 size、配 design system color tokens（選中色 = nudgePrimary 而
///   非系統藍）、跨日 navigation 行為自己控
/// - 程式碼 ~80 行，不依賴第三方 dep
public struct MoveToDatePickerView: View {
    @State private var pickedDate: Date
    public let onPick: (String) -> Void
    public let onCancel: () -> Void

    public init(initialDate: String, onPick: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
        self.onPick = onPick
        self.onCancel = onCancel
        _pickedDate = State(initialValue: DateFormatters.parseISODate(initialDate) ?? Date())
    }

    public var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("task.moveToOtherDate", bundle: .module)
                    .nudgeFont(.columnDetailTitle)
                    .foregroundStyle(Color.nudgeForeground)
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 22)
            .padding(.bottom, 18)

            NudgeCalendar(selectedDate: $pickedDate)
                .padding(.horizontal, 24)

            Spacer(minLength: 16)

            HStack(spacing: 16) {
                Spacer()
                Button(action: onCancel) {
                    Text("common.cancel", bundle: .module)
                        .nudgeFont(.inlineButtonLabel)
                        .foregroundStyle(Color.nudgeTextDim)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.cancelAction)

                Button {
                    onPick(DateFormatters.isoDate(pickedDate))
                } label: {
                    Text("common.confirm", bundle: .module)
                        .nudgeFont(.inlineButtonLabel)
                        .foregroundStyle(Color.nudgePrimaryForeground)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(Color.nudgePrimary))
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 22)
        }
        .background(Color.nudgeBackground)
        .frame(minWidth: 380, idealWidth: 420, minHeight: 460)
        #if os(iOS)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        #endif
    }
}
