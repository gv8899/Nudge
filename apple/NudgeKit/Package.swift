// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "NudgeKit",
    platforms: [
        .iOS("26.0"),
        .macOS(.v15),
    ],
    products: [
        .library(name: "NudgeCore", targets: ["NudgeCore"]),
        .library(name: "NudgeData", targets: ["NudgeData"]),
        .library(name: "NudgeUI", targets: ["NudgeUI"]),
    ],
    targets: [
        .target(name: "NudgeCore"),
        .target(name: "NudgeData", dependencies: ["NudgeCore"]),
        .target(
            name: "NudgeUI",
            dependencies: ["NudgeCore", "NudgeData"],
            resources: [
                .process("Resources/Assets.xcassets"),
                .process("Resources/Localizable.xcstrings"),
                .copy("Resources/Editor")
            ]
        ),
        .testTarget(name: "NudgeCoreTests", dependencies: ["NudgeCore", "NudgeData", "NudgeUI"]),
    ]
)
