import Foundation

enum APIEndpoint {
    case health
    case auth

    var path: String {
        switch self {
        case .health: return "/health"
        case .auth: return "/auth"
        }
    }
}
