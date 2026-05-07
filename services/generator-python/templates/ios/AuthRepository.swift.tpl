import Foundation

final class AuthRepository {
    private let tokenKey = "${project_slug}.auth.token"

    func store(token: String) {
        UserDefaults.standard.set(token, forKey: tokenKey)
    }

    func currentToken() -> String? {
        UserDefaults.standard.string(forKey: tokenKey)
    }
}
