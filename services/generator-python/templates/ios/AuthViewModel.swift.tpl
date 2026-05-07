import Foundation

@MainActor
final class AuthViewModel: ObservableObject {
    @Published private(set) var isAuthenticated = false

    private let service = AuthService()
    private let repository = AuthRepository()

    func signIn(email: String, password: String) async {
        let token = await service.signIn(email: email, password: password)
        repository.store(token: token)
        isAuthenticated = true
    }
}
