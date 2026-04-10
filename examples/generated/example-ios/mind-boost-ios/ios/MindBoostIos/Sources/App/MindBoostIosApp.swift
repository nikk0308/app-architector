import SwiftUI

@main
struct MindBoostIosApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            HomeView()
        }
    }
}
