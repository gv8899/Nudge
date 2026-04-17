import SwiftUI
import NudgeCore

public struct CalendarSectionView: View {
    public let events: [CalendarEventDTO]
    public let isConnected: Bool
    public let onConnectTapped: () -> Void

    @State private var isExpanded: Bool = false

    public init(events: [CalendarEventDTO], isConnected: Bool, onConnectTapped: @escaping () -> Void) {
        self.events = events
        self.isConnected = isConnected
        self.onConnectTapped = onConnectTapped
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if isConnected {
                HStack {
                    Text("calendar.panelTitle", bundle: .module)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color.nudgeTextDim)
                    Spacer()
                    if !events.isEmpty {
                        Button(action: { isExpanded.toggle() }) {
                            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                                .foregroundStyle(Color.nudgeTextDim)
                        }
                        .buttonStyle(.plain)
                    }
                }

                if events.isEmpty {
                    Text("calendar.panelEmpty", bundle: .module)
                        .font(.footnote)
                        .foregroundStyle(Color.nudgeTextDim)
                } else if isExpanded {
                    ForEach(events, id: \.id) { event in
                        eventRow(event)
                    }
                } else {
                    Text(verbatim: String(
                        format: NSLocalizedString("calendar.mobileCollapsedCount", bundle: .module, comment: ""),
                        events.count
                    ))
                        .font(.footnote)
                        .foregroundStyle(Color.nudgeTextDim)
                }
            } else {
                Button(action: onConnectTapped) {
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.nudgePrimary)
                            .frame(width: 16, height: 16)
                        Text("calendar.connectTitle", bundle: .module)
                            .foregroundStyle(Color.nudgeForeground)
                        Spacer()
                        Image(systemName: "arrow.right")
                            .foregroundStyle(Color.nudgeTextDim)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color.nudgePrimary.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.nudgeBorderLight, lineWidth: 1)
                    )
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.nudgeBackground)
    }

    @ViewBuilder
    private func eventRow(_ event: CalendarEventDTO) -> some View {
        HStack {
            VStack(alignment: .leading) {
                Text(event.summary)
                    .font(.body)
                    .foregroundStyle(Color.nudgeForeground)
                HStack {
                    Text(timeRange(event))
                        .font(.caption)
                        .foregroundStyle(Color.nudgeTextDim)
                    if let location = event.location {
                        Text("·")
                            .foregroundStyle(Color.nudgeTextDim)
                        Text(location)
                            .font(.caption)
                            .foregroundStyle(Color.nudgeTextDim)
                            .lineLimit(1)
                    }
                }
            }
            Spacer()
        }
        .padding(.vertical, 4)
    }

    private func timeRange(_ event: CalendarEventDTO) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return "\(formatter.string(from: event.start)) - \(formatter.string(from: event.end))"
    }
}
