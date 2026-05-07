import Foundation

final class PersistenceRepository {
    private let service = PersistenceService()

    func save(value: String, for key: String) {
        service.save(value: value, forKey: key)
    }
}
