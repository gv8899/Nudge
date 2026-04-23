import SwiftUI
import NudgeCore

/// Vertical-list tag manager with drag-to-reorder. Each row supports
/// inline rename, delete (swipe / button), and color-less display.
/// Reorder via long-press-drag on iOS or grab handle on macOS; the new
/// `sortOrder` is PATCH-ed back per affected tag.
public struct TagManagerView: View {
    @Environment(TagRepository.self) private var tagRepo
    @State private var tags: [TagDTO] = []
    @State private var isLoading = true

    @State private var newName: String = ""
    @State private var renamingId: String?
    @State private var renameText: String = ""
    @State private var pendingDelete: TagDTO?
    @FocusState private var renameFieldFocused: String?

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            if isLoading {
                HStack {
                    ProgressView().controlSize(.small)
                    Spacer()
                }
                .padding(16)
            } else {
                ForEach(Array(tags.enumerated()), id: \.element.id) { index, tag in
                    tagRow(tag)
                    if index < tags.count - 1 || true {
                        Rectangle()
                            .fill(Color.nudgeBorderLight)
                            .frame(height: 1)
                    }
                }
                addRow
            }
        }
        .task { await reload() }
        .alert(
            Text("tags.deleteTitle", bundle: .module),
            isPresented: .init(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            presenting: pendingDelete
        ) { tag in
            Button(role: .cancel, action: {}) {
                Text("common.cancel", bundle: .module)
            }
            Button(role: .destructive) {
                Task { await delete(tag) }
            } label: {
                Text("common.delete", bundle: .module)
            }
        } message: { tag in
            Text("tags.deleteConfirm \(tag.name)", bundle: .module)
        }
    }

    @ViewBuilder
    private func tagRow(_ tag: TagDTO) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "line.3.horizontal")
                .foregroundStyle(Color.nudgeTextDim)
                .frame(width: 20)

            if renamingId == tag.id {
                TextField("", text: $renameText)
                    .focused($renameFieldFocused, equals: tag.id)
                    .submitLabel(.done)
                    .onSubmit { Task { await commitRename(tag) } }
                    .font(.subheadline)
                    .foregroundStyle(Color.nudgeForeground)
            } else {
                Button {
                    renameText = tag.name
                    renamingId = tag.id
                    renameFieldFocused = tag.id
                } label: {
                    Text(verbatim: tag.name)
                        .font(.subheadline)
                        .foregroundStyle(Color.nudgeForeground)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }

            Button {
                pendingDelete = tag
            } label: {
                Image(systemName: "trash")
                    .font(.footnote)
                    .foregroundStyle(Color.nudgeTextDim)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text("tags.deleteTitle", bundle: .module))
        }
        .frame(minHeight: 44)
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
        .draggable(tag.id) {
            // Drag preview chip
            Text(verbatim: tag.name)
                .font(.subheadline)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Capsule().fill(Color.nudgeBackground))
                .overlay(Capsule().stroke(Color.nudgeBorderLight, lineWidth: 1))
        }
        .dropDestination(for: String.self) { droppedIds, _ in
            guard let droppedId = droppedIds.first,
                  let from = tags.firstIndex(where: { $0.id == droppedId }),
                  let to = tags.firstIndex(where: { $0.id == tag.id }),
                  from != to else { return false }
            withAnimation(.easeOut(duration: 0.2)) {
                let moved = tags.remove(at: from)
                tags.insert(moved, at: to)
            }
            Task { await persistOrder() }
            return true
        }
    }

    @ViewBuilder
    private var addRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "plus.circle")
                .foregroundStyle(Color.nudgePrimary)
                .frame(width: 20)
            TextField(
                "",
                text: $newName,
                prompt: Text("tags.newTagPlaceholder", bundle: .module)
            )
            .submitLabel(.done)
            .onSubmit { Task { await create() } }
            .font(.subheadline)
            .foregroundStyle(Color.nudgeForeground)
            if !newName.trimmingCharacters(in: .whitespaces).isEmpty {
                Button {
                    Task { await create() }
                } label: {
                    Text("tags.add", bundle: .module)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Color.nudgePrimary)
                }
                .buttonStyle(.plain)
            }
        }
        .frame(minHeight: 44)
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
    }

    // MARK: - Actions

    private func reload() async {
        isLoading = true
        defer { isLoading = false }
        do {
            tags = try await tagRepo.reload()
        } catch {
            print("[TagManager] reload failed: \(error)")
        }
    }

    private func create() async {
        let name = newName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        do {
            _ = try await tagRepo.create(name: name)
            newName = ""
            tags = try await tagRepo.reload()
        } catch {
            print("[TagManager] create failed: \(error)")
        }
    }

    private func commitRename(_ tag: TagDTO) async {
        let name = renameText.trimmingCharacters(in: .whitespaces)
        defer { renamingId = nil }
        guard !name.isEmpty, name != tag.name else { return }
        do {
            _ = try await tagRepo.update(id: tag.id, name: name)
            tags = try await tagRepo.reload()
        } catch {
            print("[TagManager] rename failed: \(error)")
        }
    }

    private func delete(_ tag: TagDTO) async {
        do {
            try await tagRepo.delete(id: tag.id)
            tags = try await tagRepo.reload()
        } catch {
            print("[TagManager] delete failed: \(error)")
        }
    }

    /// Sends PATCH for each tag whose index changed after a drag.
    /// Server stores integers; we reassign 0..N to the new local order.
    /// Sequential rather than parallel — fewer than 50 tags expected,
    /// and parallel @MainActor task-groups trip Swift 6's isolation checker.
    private func persistOrder() async {
        for (idx, tag) in tags.enumerated() where tag.sortOrder != idx {
            _ = try? await tagRepo.update(id: tag.id, sortOrder: idx)
        }
        tagRepo.invalidate()
    }
}
