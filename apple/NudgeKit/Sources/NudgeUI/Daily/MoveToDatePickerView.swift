import SwiftUI
import NudgeCore

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
        NavigationStack {
            DatePicker(
                "",
                selection: $pickedDate,
                displayedComponents: [.date]
            )
            .labelsHidden()
            .datePickerStyle(.graphical)
            .tint(Color.nudgePrimary)
            .environment(\.calendar, Calendar(identifier: .gregorian))
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(Color.nudgeBackground)
            .navigationTitle(Text("task.moveToOtherDate", bundle: .module))
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(action: onCancel) {
                        Image(systemName: "xmark")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Color.nudgeTextDim)
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text("common.cancel", bundle: .module))
                }
            }
            .safeAreaInset(edge: .bottom) {
                HStack {
                    Spacer()
                    Button(action: {
                        onPick(DateFormatters.isoDate(pickedDate))
                    }) {
                        Text("common.confirm", bundle: .module)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.nudgePrimaryForeground)
                            .padding(.horizontal, 24)
                            .padding(.vertical, 10)
                            .background(
                                Capsule().fill(Color.nudgePrimary)
                            )
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(Color.nudgeBackground)
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}
