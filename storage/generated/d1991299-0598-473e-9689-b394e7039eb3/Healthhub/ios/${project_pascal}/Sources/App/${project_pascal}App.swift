import SwiftUI

@main
struct ${project_pascal}App: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            HomeView()
        }
    }
}
