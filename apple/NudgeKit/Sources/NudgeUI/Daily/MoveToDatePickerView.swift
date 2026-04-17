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
            VStack(spacing: 0) {
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
                .padding(.top, 8)

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.nudgeBackground)
            .navigationTitle(Text("task.moveToOtherDate", bundle: .module))
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(action: onCancel) {
                        Text("common.cancel", bundle: .module)
                            .foregroundStyle(Color.nudgeTextDim)
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: {
                        onPick(DateFormatters.isoDate(pickedDate))
                    }) {
                        Text("common.save", bundle: .module)
                            .fontWeight(.medium)
                            .foregroundStyle(Color.nudgePrimary)
                    }
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}
