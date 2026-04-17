import SwiftUI
#if os(iOS)
import UIKit

/// One-shot global UIKit appearance configuration so system-owned bars
/// (tab bar, navigation bar) inherit the Nudge tokens by default.
///
/// Call `NudgeAppearance.configure()` once at app startup (e.g. from
/// the `App` struct's init). Safe to call multiple times — it only
/// reads colours, never mutates.
public enum NudgeAppearance {
    public static func configure() {
        configureTabBar()
        configureNavigationBar()
    }

    private static func configureTabBar() {
        let tab = UITabBarAppearance()
        tab.configureWithOpaqueBackground()
        tab.backgroundColor = color("nudge.background") ?? .systemBackground

        let primary = color("nudge.primary") ?? .systemOrange
        let dim = color("nudge.textDim") ?? .secondaryLabel

        let item = UITabBarItemAppearance()
        item.normal.iconColor = dim
        item.normal.titleTextAttributes = [.foregroundColor: dim]
        item.selected.iconColor = primary
        item.selected.titleTextAttributes = [.foregroundColor: primary]

        tab.stackedLayoutAppearance = item
        tab.inlineLayoutAppearance = item
        tab.compactInlineLayoutAppearance = item

        UITabBar.appearance().standardAppearance = tab
        UITabBar.appearance().scrollEdgeAppearance = tab
    }

    private static func configureNavigationBar() {
        let nav = UINavigationBarAppearance()
        nav.configureWithOpaqueBackground()
        nav.backgroundColor = color("nudge.background") ?? .systemBackground

        let fg = color("nudge.foreground") ?? .label
        let dim = color("nudge.textDim") ?? .secondaryLabel

        nav.titleTextAttributes = [.foregroundColor: fg]
        nav.largeTitleTextAttributes = [.foregroundColor: fg]

        let buttonItem = UIBarButtonItemAppearance()
        buttonItem.normal.titleTextAttributes = [.foregroundColor: dim]
        nav.buttonAppearance = buttonItem

        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
        UINavigationBar.appearance().compactAppearance = nav
    }

    private static func color(_ name: String) -> UIColor? {
        UIColor(named: name, in: .module, compatibleWith: nil)
    }
}

#else
public enum NudgeAppearance {
    public static func configure() { /* no-op on macOS — SwiftUI tokens cover it */ }
}
#endif
