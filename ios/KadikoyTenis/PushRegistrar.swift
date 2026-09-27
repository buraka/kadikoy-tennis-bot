import UIKit
import UserNotifications

/// Asks for notification permission and keeps the backend's copy of {token, filters} up to date
@MainActor
final class PushRegistrar: ObservableObject {
    static let shared = PushRegistrar()

    @Published private(set) var authorization: UNAuthorizationStatus = .notDetermined
    @Published private(set) var lastSyncFailed = false

    private var deviceToken: String?
    private var syncTask: Task<Void, Never>?

    /// Debug builds from Xcode get sandbox tokens; TestFlight builds get production tokens
    private var environment: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    func refreshAuthorization() async {
        authorization = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        if authorization == .authorized || authorization == .provisional {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func requestAuthorization() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        await refreshAuthorization()
    }

    func didRegister(token: Data) {
        deviceToken = token.map { String(format: "%02x", $0) }.joined()
        sync()
    }

    /// Debounced so flipping several toggles sends one request
    func sync() {
        guard let token = deviceToken, let url = AppConfig.registerURL else { return }
        let preferences = Preferences.shared
        let body: [String: Any] = [
            "token": token,
            "environment": environment,
            "courts": Array(preferences.selectedCourts),
            "primeOnly": preferences.primeOnly,
        ]
        syncTask?.cancel()
        syncTask = Task {
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(AppConfig.appSecret, forHTTPHeaderField: "x-app-secret")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
            let response = try? await URLSession.shared.data(for: request).1 as? HTTPURLResponse
            lastSyncFailed = response?.statusCode != 200
        }
    }
}
