import Foundation

/// ${boundary_description}
final class ${boundary_name} {
    private let configPath = "${boundary_config_path}"
    private let dependencies = "${boundary_dependencies}"

    func prepare() -> String {
        "${boundary_role}: \(configPath) -> \(dependencies)"
    }
}
