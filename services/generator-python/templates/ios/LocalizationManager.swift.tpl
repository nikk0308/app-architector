import Foundation

final class LocalizationManager {
    func text(_ key: String) -> String {
        NSLocalizedString(key, comment: "")
    }
}
