import SwiftUI
import NudgeCore

/// Chip-cloud tag manager: every tag is an outlined capsule that wraps
/// to multiple lines. Tap a chip to rename / delete via menu. A trailing
/// "+" chip toggles into a text field for adding new tags.
public struct TagManagerView: View {
    @Environment(TagRepository.self) private var tagRepo
    @State private var tags: [TagDTO] = []
    @State private var isLoading = true

    @State private var newName: String = ""
    @State private var isAdding = false
    @FocusState private var addFieldFocused: Bool

    @State private var renaming: TagDTO?
    @State private var renameText: String = ""
    @State private var pendingDelete: TagDTO?

    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if isLoading {
                HStack {
                    ProgressView().controlSize(.small)
                    Spacer()
                }
                .padding(16)
            } else {
                FlowLayout(spacing: 8, lineSpacing: 8) {
                    ForEach(tags) { tag in
                        Menu {
                            Button {
                                renameText = tag.name
                                renaming = tag
                            } label: {
                                Label {
                                    Text("common.edit", bundle: .module)
                                } icon: {
                                    Image(systemName: "pencil")
                                }
                            }
                            Button(role: .destructive) {
                                pendingDelete = tag
                            } label: {
                                Label {
                                    Text("common.delete", bundle: .module)
                                } icon: {
                                    Image(systemName: "trash")
                                }
                            }
                        } label: {
                            chipLabel(tag.name)
                        }
                        .menuStyle(.borderlessButton)
                    }

                    if isAdding {
                        addInput
                    } else {
                        Button {
                            isAdding = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                                addFieldFocused = true
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "plus")
                                    .font(.caption.weight(.semibold))
                                Text("tags.add", bundle: .module)
                                    .font(.footnote)
                            }
                            .foregroundStyle(Color.nudgePrimary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .overlay(
                                Capsule().stroke(Color.nudgePrimary.opacity(0.5), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
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
        .alert(
            Text("common.edit", bundle: .module),
            isPresented: .init(
                get: { renaming != nil },
                set: { if !$0 { renaming = nil } }
            ),
            presenting: renaming
        ) { tag in
            TextField("", text: $renameText)
            Button(role: .cancel, action: {}) {
                Text("common.cancel", bundle: .module)
            }
            Button {
                Task { await commitRename(tag) }
            } label: {
                Text("common.save", bundle: .module)
            }
        }
    }

    private func chipLabel(_ name: String) -> some View {
        Text(name)
            .font(.footnote)
            .foregroundStyle(Color.nudgeForeground)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .overlay(
                Capsule().stroke(Color.nudgeBorderLight, lineWidth: 1)
            )
    }

    private var addInput: some View {
        HStack(spacing: 4) {
            TextField(
                "",
                text: $newName,
                prompt: Text("tags.newTagPlaceholder", bundle: .module)
            )
            .focused($addFieldFocused)
            .submitLabel(.done)
            .onSubmit { Task { await create() } }
            .font(.footnote)
            .foregroundStyle(Color.nudgeForeground)
            .frame(minWidth: 100)

            Button {
                isAdding = false
                newName = ""
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(Color.nudgeTextDim)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .overlay(
            Capsule().stroke(Color.nudgePrimary, lineWidth: 1)
        )
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
        defer { renaming = nil }
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
}
