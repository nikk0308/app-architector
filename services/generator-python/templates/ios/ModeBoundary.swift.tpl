import Foundation

/// Records how ${mode_display_name} contributed to the generated ArchitectureSpec.
struct ${mode_boundary_pascal} {
    let mode = "${generation_mode}"
    let strategy = "${mode_strategy_summary}"
    let relationship = "${mode_relationship_summary}"

    func explain() -> String {
        "\(mode): \(strategy)"
    }
}
