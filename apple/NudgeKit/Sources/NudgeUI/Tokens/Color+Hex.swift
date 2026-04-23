import SwiftUI

#if os(iOS)
import UIKit
typealias PlatformColor = UIColor
#else
import AppKit
typealias PlatformColor = NSColor
#endif

extension Color {
    /// Resolve the Color to a platform-native color under a specific
    /// color-scheme, then emit `#RRGGBB`. Needed for WKWebView JS that
    /// can't read SwiftUI Color directly.
    @MainActor
    func cssHex(for scheme: ColorScheme) -> String {
        #if os(iOS)
        let trait = UITraitCollection(userInterfaceStyle: scheme == .dark ? .dark : .light)
        let resolved = UIColor(self).resolvedColor(with: trait)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        resolved.getRed(&r, green: &g, blue: &b, alpha: &a)
        #else
        let appearance = NSAppearance(named: scheme == .dark ? .darkAqua : .aqua)
        let ns = NSColor(self)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        if let appearance {
            appearance.performAsCurrentDrawingAppearance {
                let rgb = ns.usingColorSpace(.sRGB) ?? ns
                rgb.getRed(&r, green: &g, blue: &b, alpha: &a)
            }
        } else {
            let rgb = ns.usingColorSpace(.sRGB) ?? ns
            rgb.getRed(&r, green: &g, blue: &b, alpha: &a)
        }
        #endif
        let ri = Int((r * 255).rounded())
        let gi = Int((g * 255).rounded())
        let bi = Int((b * 255).rounded())
        return String(format: "#%02X%02X%02X", ri, gi, bi)
    }
}
