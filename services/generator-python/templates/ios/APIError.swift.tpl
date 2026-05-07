import Foundation

enum APIError: Error {
    case invalidURL
    case requestFailed
    case unauthorized
    case decodingFailed
}
