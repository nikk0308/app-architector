import Foundation

final class AppCoordinator {
    private(set) var currentRoute: NavigationRoute = .home

    func start() {
        currentRoute = .home
    }
}
