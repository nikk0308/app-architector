import SwiftUI

struct HomeView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("home.title")
                    .font(.title)
                Text("home.subtitle")
                    .foregroundStyle(.secondary)
                Text("home.generatedScreen")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}
