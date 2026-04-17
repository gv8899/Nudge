import SwiftUI

public extension Color {
    static let nudgeBackground = Color("nudge.background", bundle: .module)
    static let nudgeForeground = Color("nudge.foreground", bundle: .module)
    static let nudgePrimary = Color("nudge.primary", bundle: .module)
    static let nudgePrimaryForeground = Color("nudge.primaryForeground", bundle: .module)
    static let nudgeBorder = Color("nudge.border", bundle: .module)
    static let nudgeBorderLight = Color("nudge.borderLight", bundle: .module)
    static let nudgeTextDim = Color("nudge.textDim", bundle: .module)
    static let nudgeChart1 = Color("nudge.chart1", bundle: .module)
    static let nudgeChart2 = Color("nudge.chart2", bundle: .module)
    static let nudgeChart3 = Color("nudge.chart3", bundle: .module)
    static let nudgeChart4 = Color("nudge.chart4", bundle: .module)
    static let nudgeChart5 = Color("nudge.chart5", bundle: .module)
    static let nudgeStatusInbox = Color("nudge.statusInbox", bundle: .module)
    static let nudgeStatusBacklog = Color("nudge.statusBacklog", bundle: .module)
    static let nudgeStatusInProgress = Color("nudge.statusInProgress", bundle: .module)
    static let nudgeStatusWaiting = Color("nudge.statusWaiting", bundle: .module)
    static let nudgeStatusDone = Color("nudge.statusDone", bundle: .module)
    static let nudgeStatusArchived = Color("nudge.statusArchived", bundle: .module)

    // MARK: - Semantic status tokens (prefer these over chart.* for status paint)

    static let nudgeDestructive = Color("nudge.destructive", bundle: .module)
    static let nudgeSuccess = Color("nudge.success", bundle: .module)
    static let nudgeWarning = Color("nudge.warning", bundle: .module)
    static let nudgeInfo = Color("nudge.info", bundle: .module)
}
