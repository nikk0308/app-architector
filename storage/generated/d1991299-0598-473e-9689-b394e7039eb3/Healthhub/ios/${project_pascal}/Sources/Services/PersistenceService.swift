import Foundation

final class PersistenceService {
    func save(value: String, forKey key: String) {
        UserDefaults.standard.set(value, forKey: key)
    }
}
