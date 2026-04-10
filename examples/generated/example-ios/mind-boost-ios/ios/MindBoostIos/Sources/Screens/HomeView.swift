import SwiftUI

struct HomeView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("Mind Boost")
                    .font(.title)
                Text("Generated iOS architecture scaffold")
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}
