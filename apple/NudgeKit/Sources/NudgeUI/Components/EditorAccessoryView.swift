// WKWebView keyboard input-accessory-view for the editor toolbar.
//
// Implementation notes — why all-UIKit, no SwiftUI:
//
// Previous attempt hosted a SwiftUI EditorToolbar inside UIHostingController
// and mounted the host's view as inputAccessoryView. The toolbar was visible
// but button taps did nothing. Root cause: UIHostingController wasn't added
// as a child view controller (an inputAccessoryView lives outside the normal
// view-controller hierarchy), so SwiftUI's responder chain for Button taps
// was broken — the view rendered but taps never reached the closure.
//
// The canonical iOS rich-editor pattern (Notes / Bear / Mast) uses plain
// UIKit inside the accessory view: a UIStackView of UIButtons. Taps go
// straight to target/action; no responder-chain surprises, no SwiftUI
// lifecycle assumptions. SwiftUI is still fine on the rest of the screen.

#if os(iOS)
import SwiftUI
import UIKit
import WebKit
import Combine
import ObjectiveC.runtime

@MainActor
final class EditorAccessoryState: ObservableObject {
    @Published var activeMarks = ActiveMarks()
}

@MainActor
final class EditorToolbarHost: UIView {
    let state = EditorAccessoryState()
    private let commandBus: EditorCommandBus
    private var stateSink: AnyCancellable?

    private let undoButton = UIButton(type: .system)
    private let redoButton = UIButton(type: .system)
    private let headingButton = UIButton(type: .system)
    private let headingLevelLabel = UILabel()
    private let bulletButton = UIButton(type: .system)
    private let orderedButton = UIButton(type: .system)
    private let taskButton = UIButton(type: .system)
    private let dismissButton = UIButton(type: .system)
    private let divider = UIView()

    private let toolbarHeight: CGFloat = 48
    private let buttonSize: CGFloat = 44

    init(commandBus: EditorCommandBus) {
        self.commandBus = commandBus
        super.init(frame: CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: toolbarHeight))
        autoresizingMask = [.flexibleWidth]
        backgroundColor = UIColor(Color.nudgeBackground)

        let topBorder = UIView()
        topBorder.backgroundColor = UIColor(Color.nudgeBorderLight)
        topBorder.translatesAutoresizingMaskIntoConstraints = false
        addSubview(topBorder)
        NSLayoutConstraint.activate([
            topBorder.leadingAnchor.constraint(equalTo: leadingAnchor),
            topBorder.trailingAnchor.constraint(equalTo: trailingAnchor),
            topBorder.topAnchor.constraint(equalTo: topAnchor),
            topBorder.heightAnchor.constraint(equalToConstant: 0.5),
        ])

        configureButton(undoButton, systemImage: "arrow.uturn.backward",
                        accessibilityKey: "editor.toolbarUndo",
                        action: #selector(undoTapped))
        configureButton(redoButton, systemImage: "arrow.uturn.forward",
                        accessibilityKey: "editor.toolbarRedo",
                        action: #selector(redoTapped))
        configureButton(headingButton, systemImage: "textformat.size",
                        accessibilityKey: "editor.toolbarHeading",
                        action: #selector(headingTapped))
        configureButton(bulletButton, systemImage: "list.bullet",
                        accessibilityKey: "editor.toolbarBullet",
                        action: #selector(bulletTapped))
        configureButton(orderedButton, systemImage: "list.number",
                        accessibilityKey: "editor.toolbarOrdered",
                        action: #selector(orderedTapped))
        configureButton(taskButton, systemImage: "checkmark.square",
                        accessibilityKey: "editor.toolbarTaskList",
                        action: #selector(taskTapped))
        configureButton(dismissButton, systemImage: "keyboard.chevron.compact.down",
                        accessibilityKey: "editor.toolbarDismiss",
                        action: #selector(dismissTapped))

        // Heading level overlay (shows "1", "2", or "3" on the headingButton
        // when a heading is active).
        headingLevelLabel.font = UIFont.systemFont(ofSize: 9, weight: .bold)
        headingLevelLabel.textColor = UIColor(Color.nudgePrimary)
        headingLevelLabel.translatesAutoresizingMaskIntoConstraints = false
        headingLevelLabel.isUserInteractionEnabled = false
        headingButton.addSubview(headingLevelLabel)
        NSLayoutConstraint.activate([
            headingLevelLabel.trailingAnchor.constraint(equalTo: headingButton.trailingAnchor, constant: -4),
            headingLevelLabel.bottomAnchor.constraint(equalTo: headingButton.bottomAnchor, constant: -6),
        ])

        divider.backgroundColor = UIColor(Color.nudgeBorderLight)
        divider.translatesAutoresizingMaskIntoConstraints = false
        divider.widthAnchor.constraint(equalToConstant: 1).isActive = true

        let leftGroup = UIStackView(arrangedSubviews: [
            undoButton, redoButton,
            wrapDivider(),
            headingButton, bulletButton, orderedButton, taskButton,
        ])
        leftGroup.axis = .horizontal
        leftGroup.alignment = .center
        leftGroup.distribution = .fill
        leftGroup.spacing = 0

        let spacer = UIView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)

        let root = UIStackView(arrangedSubviews: [leftGroup, spacer, dismissButton])
        root.axis = .horizontal
        root.alignment = .center
        root.distribution = .fill
        root.spacing = 0
        root.translatesAutoresizingMaskIntoConstraints = false
        addSubview(root)
        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            root.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            root.topAnchor.constraint(equalTo: topAnchor),
            root.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        stateSink = state.$activeMarks.sink { [weak self] marks in
            self?.refreshState(marks)
        }
        refreshState(state.activeMarks)
    }

    required init?(coder: NSCoder) { fatalError("not supported") }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: toolbarHeight)
    }

    // MARK: - Button wiring

    private func configureButton(
        _ button: UIButton,
        systemImage: String,
        accessibilityKey: String,
        action: Selector
    ) {
        let config = UIImage.SymbolConfiguration(pointSize: 17, weight: .regular)
        button.setImage(UIImage(systemName: systemImage, withConfiguration: config), for: .normal)
        button.tintColor = UIColor(Color.nudgeTextDim)
        button.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: buttonSize),
            button.heightAnchor.constraint(equalToConstant: buttonSize),
        ])
        button.addTarget(self, action: action, for: .touchUpInside)
        button.accessibilityLabel = NSLocalizedString(accessibilityKey, bundle: .module, comment: "")
    }

    private func wrapDivider() -> UIView {
        let container = UIView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(divider)
        NSLayoutConstraint.activate([
            container.widthAnchor.constraint(equalToConstant: 9),
            divider.heightAnchor.constraint(equalToConstant: 20),
            divider.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            divider.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        ])
        return container
    }

    // MARK: - State sync

    private func refreshState(_ marks: ActiveMarks) {
        undoButton.isEnabled = marks.canUndo
        undoButton.alpha = marks.canUndo ? 1 : 0.4
        redoButton.isEnabled = marks.canRedo
        redoButton.alpha = marks.canRedo ? 1 : 0.4

        let active = UIColor(Color.nudgePrimary)
        let inactive = UIColor(Color.nudgeTextDim)

        headingButton.tintColor = (marks.heading != nil) ? active : inactive
        if let level = marks.heading {
            headingLevelLabel.text = "\(level)"
            headingLevelLabel.isHidden = false
        } else {
            headingLevelLabel.text = nil
            headingLevelLabel.isHidden = true
        }
        bulletButton.tintColor = marks.bulletList ? active : inactive
        orderedButton.tintColor = marks.orderedList ? active : inactive
        taskButton.tintColor = marks.taskList ? active : inactive
        dismissButton.tintColor = inactive
    }

    // MARK: - Actions

    @objc private func undoTapped() { commandBus.send(.undo) }
    @objc private func redoTapped() { commandBus.send(.redo) }
    @objc private func bulletTapped() { commandBus.send(.toggleBulletList) }
    @objc private func orderedTapped() { commandBus.send(.toggleOrderedList) }
    @objc private func taskTapped() { commandBus.send(.toggleTaskList) }
    @objc private func dismissTapped() { commandBus.send(.blur) }

    @objc private func headingTapped() {
        // Cycle: none → H1 → H2 → H3 → none
        switch state.activeMarks.heading {
        case nil:
            commandBus.send(.toggleHeading(level: 1))
        case 1:
            commandBus.send(.toggleHeading(level: 2))
        case 2:
            commandBus.send(.toggleHeading(level: 3))
        default:
            // Toggling the current level off reverts to paragraph
            commandBus.send(.toggleHeading(level: state.activeMarks.heading ?? 3))
        }
    }
}

// MARK: - WKWebView inputAccessoryView install (runtime subclass)

nonisolated(unsafe) private var nudgeAccessoryKey: UInt8 = 0

extension WKWebView {
    fileprivate var nudgeContentView: UIView? {
        func search(_ v: UIView) -> UIView? {
            if String(describing: type(of: v)).contains("WKContent") { return v }
            for sub in v.subviews {
                if let hit = search(sub) { return hit }
            }
            return nil
        }
        return search(self)
    }

    func nudgeInstallInputAccessoryView(_ view: UIView) {
        guard let target = nudgeContentView else { return }
        objc_setAssociatedObject(target, &nudgeAccessoryKey, view, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)

        let originalClass: AnyClass = object_getClass(target)!
        let subclassName = "\(NSStringFromClass(originalClass))_NudgeAccessory"

        if let existing = NSClassFromString(subclassName) {
            object_setClass(target, existing)
            target.reloadInputViews()
            return
        }

        guard let subclass = objc_allocateClassPair(originalClass, subclassName, 0) else { return }
        let selector = #selector(getter: UIResponder.inputAccessoryView)
        let block: @convention(block) (Any) -> UIView? = { obj in
            objc_getAssociatedObject(obj, &nudgeAccessoryKey) as? UIView
        }
        let imp = imp_implementationWithBlock(block)
        class_addMethod(subclass, selector, imp, "@@:")
        objc_registerClassPair(subclass)
        object_setClass(target, subclass)
        target.reloadInputViews()
    }
}
#endif
