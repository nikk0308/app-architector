import Foundation
import UserNotifications

final class PushService {
    func register() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }
}
