import Foundation

final class NetworkClient {
    let baseURL = URL(string: "https://api.example.com")!

    func makeRequest(path: String) -> URLRequest {
        URLRequest(url: baseURL.appendingPathComponent(path))
    }
}
