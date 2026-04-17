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
        VStack(alignment: .leading, spacing: 16) {
            Text("task.moveToOtherDate", bundle: .module)
                .font(.headline)
                .foregroundStyle(Color.nudgeForeground)

            DatePicker(
                "",
                selection: $pickedDate,
                displayedComponents: [.date]
            )
            .labelsHidden()
            .datePickerStyle(.graphical)
            .tint(Color.nudgePrimary)
            .environment(\.calendar, Calendar(identifier: .gregorian))

            HStack {
                Button(action: onCancel) {
                    Text("common.cancel", bundle: .module)
                        .foregroundStyle(Color.nudgeTextDim)
                }
                .buttonStyle(.plain)

                Spacer()

                Button(action: {
                    onPick(DateFormatters.isoDate(pickedDate))
                }) {
                    Text("common.save", bundle: .module)
                        .fontWeight(.medium)
                        .foregroundStyle(Color.nudgePrimary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 24)
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.nudgeBackground)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}
