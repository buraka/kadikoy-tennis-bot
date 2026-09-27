import SwiftUI
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in PushRegistrar.shared.didRegister(token: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("push registration failed:", error)
    }

    // Show the banner even while the app is open, and refresh the list
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        NotificationCenter.default.post(name: .slotsChanged, object: nil)
        return [.banner, .sound, .list]
    }

    // Tapping a notification opens the court's calendar on the site
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        NotificationCenter.default.post(name: .slotsChanged, object: nil)
        let userInfo = response.notification.request.content.userInfo
        guard let court = userInfo["court"] as? [String: String],
              let branchId = court["b"], let facilityId = court["t"], let courtKey = court["s"]
        else { return }
        let url = AppConfig.courtURL(branchId: branchId, facilityId: facilityId, courtKey: courtKey)
        await MainActor.run { UIApplication.shared.open(url) }
    }
}

extension Notification.Name {
    static let slotsChanged = Notification.Name("slotsChanged")
}

@main
struct KadikoyTenisApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var store = SlotStore()
    @StateObject private var preferences = Preferences.shared
    @StateObject private var push = PushRegistrar.shared

    var body: some Scene {
        WindowGroup {
            SlotsView()
                .environmentObject(store)
                .environmentObject(preferences)
                .environmentObject(push)
                .tint(Color("AccentColor"))
        }
    }
}
