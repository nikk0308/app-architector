import Foundation

protocol AuthServiceProtocol {
    func signInAnonymously() async throws
}

final class AuthService: AuthServiceProtocol {
    func signInAnonymously() async throws { }
}
