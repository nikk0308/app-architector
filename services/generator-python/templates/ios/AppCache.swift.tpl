import Foundation

final class AppCache {
    private var values: [String: String] = [:]

    subscript(key: String) -> String? {
        get { values[key] }
        set { values[key] = newValue }
    }
}
