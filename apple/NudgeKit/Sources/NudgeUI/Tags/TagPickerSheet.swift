import SwiftUI
import NudgeCore

/// Sheet for choosing which tags apply to a card. Mirrors web's
/// `tag-picker.tsx`: search filters + tap to toggle + create-from-search
/// inline. Returns the new tagIds set via `onCommit`.
public struct TagPickerSheet: View {
    public let initiallySelectedIds: Set<String>
    public let onCommit: (Set<String>) -> Void
    public let onCancel: () -> Void

    @Environment(TagRepository.self) private var tagRepo
    @State private var allTags: [TagDTO] = []
    @State private var selectedIds: Set<String>
    @State private var query: String = ""
    @State private var isLoading = true
    @FocusState private var searchFocused: Bool

    public init(
        initiallySelectedIds: Set<String>,
        onCommit: @escaping (Set<String>) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.initiallySelectedIds = initiallySelectedIds
        self.onCommit = onCommit
        self.onCancel = onCancel
        _selectedIds = State(initialValue: initiallySelectedIds)
    }

    private var filtered: [TagDTO] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty { return allTags }
        return allTags.filter { $0.name.lowercased().contains(q) }
    }

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespaces)
    }

    private var hasExactMatch: Bool {
        !trimmedQuery.isEmpty &&
            allTags.contains { $0.name.lowercased() == trimmedQuery.lowercased() }
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchBar
                Divider().background(Color.nudgeBorderLight)
                if isLoading {
                    HStack { ProgressView().controlSize(.small); Spacer() }
                        .padding(16)
                } else {
                    list
                }
            }
            .background(Color.nudgeBackground)
            .navigationTitle(Text("tags.addTag", bundle: .module))
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
                    Button {
                        onCommit(selectedIds)
                    } label: {
                        Text("common.save", bundle: .module)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color.nudgePrimary)
                    }
                }
            }
        }
        .task { await reload() }
        #if os(macOS)
        // 固定尺寸 — 與卡片 modal 同款的穩定 modal，不隨清單長度跳動。
        .frame(width: 460, height: 560)
        #endif
    }

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.nudgeTextDim)
            TextField(
                "",
                text: $query,
                prompt: Text("tags.searchOrCreate", bundle: .module)
            )
            .focused($searchFocused)
            .textFieldStyle(.plain)
            .submitLabel(.search)
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.nudgeTextDim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private var list: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(filtered) { tag in
                    Button {
                        toggle(tag.id)
                    } label: {
                        HStack {
                            Text(verbatim: tag.name)
                                .foregroundStyle(Color.nudgeForeground)
                            Spacer()
                            if selectedIds.contains(tag.id) {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.nudgePrimary)
                            }
                        }
                        .frame(minHeight: 44)
                        .padding(.horizontal, 16)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Rectangle()
                        .fill(Color.nudgeBorderLight)
                        .frame(height: 1)
                        .padding(.leading, 16)
                }

                if !trimmedQuery.isEmpty && !hasExactMatch {
                    Button {
                        Task { await createAndSelect(name: trimmedQuery) }
                    } label: {
                        HStack {
                            Image(systemName: "plus")
                            Text("tags.createNamed \(trimmedQuery)", bundle: .module)
                            Spacer()
                        }
                        .foregroundStyle(Color.nudgePrimary)
                        .frame(minHeight: 44)
                        .padding(.horizontal, 16)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Actions

    private func reload() async {
        isLoading = true
        defer { isLoading = false }
        do {
            allTags = try await tagRepo.list()
        } catch {
            if APIError.isCancellation(error) { return }
            print("[TagPicker] reload failed: \(error)")
        }
    }

    private func toggle(_ id: String) {
        if selectedIds.contains(id) {
            selectedIds.remove(id)
        } else {
            selectedIds.insert(id)
        }
    }

    private func createAndSelect(name: String) async {
        do {
            let tag = try await tagRepo.create(name: name)
            allTags = try await tagRepo.reload()
            selectedIds.insert(tag.id)
            query = ""
        } catch {
            print("[TagPicker] create failed: \(error)")
        }
    }
}
