import SwiftUI
import NudgeCore

public struct MoveToDatePickerView: View {
    @State private var pickedDate: Date = Date()
    public let initialDate: String
    public let onPick: (String) -> Void
    public let onCancel: () -> Void

    public init(initialDate: String, onPick: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
        self.initialDate = initialDate
        self.onPick = onPick
        self.onCancel = onCancel
    }

    public var body: some View {
        VStack {
            DatePicker(
                "task.moveToOtherDate",
                selection: $pickedDate,
                displayedComponents: [.date]
            )
            .datePickerStyle(.graphical)
            .onAppear {
                if let d = DateFormatters.parseISODate(initialDate) {
                    pickedDate = d
                }
            }

            HStack {
                Button(action: onCancel) {
                    Text("common.cancel", bundle: .module)
                }
                Spacer()
                Button(action: {
                    onPick(DateFormatters.isoDate(pickedDate))
                }) {
                    Text("common.save", bundle: .module)
                        .fontWeight(.medium)
                }
            }
            .padding()
        }
        .padding()
    }
}
