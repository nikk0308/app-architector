import Foundation

final class AppState: ObservableObject {
    @Published var route: String = "home"
}
