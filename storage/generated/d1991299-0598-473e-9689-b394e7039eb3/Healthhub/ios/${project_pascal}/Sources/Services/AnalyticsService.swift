import Foundation

final class AnalyticsService {
    func track(screen: String) {
        print("[Analytics] \(screen)")
    }
}
