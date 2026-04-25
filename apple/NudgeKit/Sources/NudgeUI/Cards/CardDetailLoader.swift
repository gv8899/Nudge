import SwiftUI
import NudgeCore

/// Fetches a CardDTO by id and presents CardDetailView. Entry points that
/// only have a task id (e.g. the Daily page, whose rows carry a TaskDTO
/// with no tags) use this instead of constructing a half-populated CardDTO
/// — initial tag-picker selection and any other CardDTO-level state must
/// reflect server truth.
///
/// Cards list callers already hold a fully populated CardDTO and push
/// CardDetailView directly; they don't need the extra fetch.
public struct CardDetailLoader: View {
    public let taskId: String
    public let onUpdateTitle: (String) -> Void
    public let onUpdateDescription: (String) -> Void
    public let onUpdateTags: (Set<String>) async -> Void

    @Environment(CardRepository.self) private var cardRepo
    @State private var card: CardDTO?
    @State private var loadError: String?

    public init(
        taskId: String,
        onUpdateTitle: @escaping (String) -> Void,
        onUpdateDescription: @escaping (String) -> Void,
        onUpdateTags: @escaping (Set<String>) async -> Void
    ) {
        self.taskId = taskId
        self.onUpdateTitle = onUpdateTitle
        self.onUpdateDescription = onUpdateDescription
        self.onUpdateTags = onUpdateTags
    }

    public var body: some View {
        Group {
            if let card {
                CardDetailView(
                    card: card,
                    onUpdateTitle: onUpdateTitle,
                    onUpdateDescription: onUpdateDescription,
                    onUpdateTags: onUpdateTags
                )
            } else if loadError != nil {
                errorState
            } else {
                loadingState
            }
        }
        .task(id: taskId) { await load() }
    }

    @ViewBuilder
    private var loadingState: some View {
        VStack {
            ProgressView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.nudgeBackground)
    }

    @ViewBuilder
    private var errorState: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 28))
                .foregroundStyle(Color.nudgeTextDim)
            Text("error.network", bundle: .module)
                .font(.body)
                .foregroundStyle(Color.nudgeForeground)
            Button {
                Task { await load() }
            } label: {
                Text("common.confirm", bundle: .module)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Color.nudgePrimary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.nudgeBackground)
    }

    private func load() async {
        loadError = nil
        do {
            card = try await cardRepo.get(cardId: taskId)
        } catch {
            if APIError.isCancellation(error) { return }
            loadError = String(describing: error)
            print("[CardDetailLoader] fetch failed: \(error)")
        }
    }
}
