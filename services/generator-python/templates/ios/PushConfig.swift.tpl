import Foundation

struct PushConfig {
    let environment: AppEnvironment
    let topic: String = "${bundle_id}"
}
