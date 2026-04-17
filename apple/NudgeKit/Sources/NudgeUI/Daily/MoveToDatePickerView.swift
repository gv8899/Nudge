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
        VStack(alignment: .leading, spacing: 24) {
            Text("task.moveToOtherDate", bundle: .module)
                .font(.headline)
                .foregroundStyle(Color.nudgeForeground)
                .padding(.top, 48)

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
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 24)
        .background(Color.nudgeBackground.ignoresSafeArea())
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}
