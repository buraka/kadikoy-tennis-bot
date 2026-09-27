import Foundation

/// Notification filters; mirrored to the backend on every change
@MainActor
final class Preferences: ObservableObject {
    static let shared = Preferences()

    private enum Keys {
        static let courts = "selectedCourts"
        static let primeOnly = "primeOnly"
    }

    /// Empty means every court (also covers courts added later)
    @Published var selectedCourts: Set<String> {
        didSet { save() }
    }
    @Published var primeOnly: Bool {
        didSet { save() }
    }

    private init() {
        let defaults = UserDefaults.standard
        selectedCourts = Set(defaults.stringArray(forKey: Keys.courts) ?? [])
        primeOnly = defaults.bool(forKey: Keys.primeOnly)
    }

    func isSelected(_ court: Court) -> Bool {
        selectedCourts.isEmpty || selectedCourts.contains(court.key)
    }

    func setSelected(_ selected: Bool, court: Court, allCourts: [Court]) {
        var next = selectedCourts.isEmpty ? Set(allCourts.map(\.key)) : selectedCourts
        if selected { next.insert(court.key) } else { next.remove(court.key) }
        guard !next.isEmpty else { return } // keep at least one court
        selectedCourts = next == Set(allCourts.map(\.key)) ? [] : next
    }

    func matches(_ slot: Slot) -> Bool {
        isSelected(slot.court) && (!primeOnly || slot.isPrime)
    }

    private func save() {
        let defaults = UserDefaults.standard
        defaults.set(Array(selectedCourts), forKey: Keys.courts)
        defaults.set(primeOnly, forKey: Keys.primeOnly)
        PushRegistrar.shared.sync()
    }
}
