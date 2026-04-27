//
//  NudgeWidgetBundle.swift
//  NudgeWidget
//
//  @main entry point for the NudgeWidget extension. Composes all widgets.
//

import WidgetKit
import SwiftUI

@main
struct NudgeWidgetBundle: WidgetBundle {
    var body: some Widget {
        QuickAddWidget()
        QuickAddCardWidget()
        TodayListWidget()
    }
}
