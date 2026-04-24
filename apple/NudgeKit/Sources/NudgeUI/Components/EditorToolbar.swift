import SwiftUI

/// 鍵盤上方（iOS）或 detail view 頂部（macOS）的格式工具列。
/// 由 RichTextEditor 提供 activeMarks + commandBus 讓 toolbar 知道當前
/// selection 狀態並送出格式命令。
public struct EditorToolbar: View {
    public let activeMarks: ActiveMarks
    public let commandBus: EditorCommandBus
    public let onDismissKeyboard: (() -> Void)?

    public init(
        activeMarks: ActiveMarks,
        commandBus: EditorCommandBus,
        onDismissKeyboard: (() -> Void)? = nil
    ) {
        self.activeMarks = activeMarks
        self.commandBus = commandBus
        self.onDismissKeyboard = onDismissKeyboard
    }

    public var body: some View {
        HStack(spacing: 0) {
            toolbarButton(
                systemName: "arrow.uturn.backward",
                labelKey: "editor.toolbarUndo",
                isEnabled: activeMarks.canUndo
            ) { commandBus.send(.undo) }

            toolbarButton(
                systemName: "arrow.uturn.forward",
                labelKey: "editor.toolbarRedo",
                isEnabled: activeMarks.canRedo
            ) { commandBus.send(.redo) }

            divider

            headingButton

            toolbarButton(
                systemName: "list.bullet",
                labelKey: "editor.toolbarBullet",
                isActive: activeMarks.bulletList
            ) { commandBus.send(.toggleBulletList) }

            toolbarButton(
                systemName: "list.number",
                labelKey: "editor.toolbarOrdered",
                isActive: activeMarks.orderedList
            ) { commandBus.send(.toggleOrderedList) }

            toolbarButton(
                systemName: "checkmark.square",
                labelKey: "editor.toolbarTaskList",
                isActive: activeMarks.taskList
            ) { commandBus.send(.toggleTaskList) }

            Spacer()

            if let onDismissKeyboard {
                toolbarButton(
                    systemName: "keyboard.chevron.compact.down",
                    labelKey: "editor.toolbarDismiss"
                ) { onDismissKeyboard() }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.nudgeBackground)
        .overlay(alignment: .top) {
            Divider().background(Color.nudgeBorderLight)
        }
    }

    @ViewBuilder
    private var headingButton: some View {
        let isActive = activeMarks.heading != nil
        Button {
            let nextLevel: Int
            switch activeMarks.heading {
            case nil: nextLevel = 1
            case 1: nextLevel = 2
            case 2: nextLevel = 3
            default: nextLevel = 0
            }
            if nextLevel == 0 {
                commandBus.send(.toggleHeading(level: activeMarks.heading ?? 3))
            } else {
                commandBus.send(.toggleHeading(level: nextLevel))
            }
        } label: {
            ZStack {
                Image(systemName: "textformat.size")
                    .font(.body)
                    .foregroundStyle(isActive ? Color.nudgePrimary : Color.nudgeTextDim)
                if let level = activeMarks.heading {
                    Text("\(level)")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Color.nudgePrimary)
                        .offset(x: 10, y: 8)
                }
            }
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text("editor.toolbarHeading", bundle: .module))
    }

    @ViewBuilder
    private func toolbarButton(
        systemName: String,
        labelKey: LocalizedStringKey,
        isEnabled: Bool = true,
        isActive: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.body)
                .foregroundStyle(
                    isActive ? Color.nudgePrimary : Color.nudgeTextDim
                )
                .opacity(isEnabled ? 1 : 0.4)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityLabel(Text(labelKey, bundle: .module))
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.nudgeBorderLight)
            .frame(width: 1, height: 20)
            .padding(.horizontal, 4)
    }
}
