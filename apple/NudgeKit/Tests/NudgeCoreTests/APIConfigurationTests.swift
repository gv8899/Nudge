import Testing
import Foundation
@testable import NudgeCore

@Test func productionConfigurationPointsToNudgeTw() {
    let config = APIConfiguration.production
    #expect(config.baseURL == URL(string: "https://nudge.tw")!)
}

@Test func developmentConfigurationPointsToLocalhost() {
    let config = APIConfiguration.development
    #expect(config.baseURL == URL(string: "http://localhost:3000")!)
}

@Test func customConfigurationUsesGivenURL() {
    let url = URL(string: "https://staging.nudge.tw")!
    let config = APIConfiguration(baseURL: url)
    #expect(config.baseURL == url)
}
