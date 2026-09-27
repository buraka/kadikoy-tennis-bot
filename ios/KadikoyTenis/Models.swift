import Foundation

enum AppConfig {
    private static func value(_ key: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String ?? "").trimmingCharacters(in: .whitespaces)
    }

    static let slotsURL = URL(string: value("SLOTS_URL"))
    static let registerURL = URL(string: value("REGISTER_URL"))
    static let appSecret = value("APP_SECRET")
    static let reservationURL = URL(string: "https://spor.kadikoy.bel.tr/AnaSayfa/AnaSayfa")!

    /// Backend page that opens a court's calendar on the site (the site only reaches it via a form POST)
    static func courtURL(branchId: String, facilityId: String, courtKey: String) -> URL {
        guard let base = registerURL,
              var components = URLComponents(url: base.appendingPathComponent("go"), resolvingAgainstBaseURL: false)
        else { return reservationURL }
        components.queryItems = [
            URLQueryItem(name: "b", value: branchId),
            URLQueryItem(name: "t", value: facilityId),
            URLQueryItem(name: "s", value: courtKey),
        ]
        return components.url ?? reservationURL
    }
}

/// slots.json written by the Lambda on every run
struct Snapshot: Decodable {
    let updatedAt: Date
    let courts: [Court]
}

struct Court: Decodable, Identifiable, Hashable {
    let key: String
    let name: String
    let branchId: String?
    let facilityId: String?
    let availableSlots: [String]

    var id: String { key }

    var calendarURL: URL {
        guard let branchId, let facilityId else { return AppConfig.reservationURL }
        return AppConfig.courtURL(branchId: branchId, facilityId: facilityId, courtKey: key)
    }

    /// "KALAMIŞ SPOR MERKEZİ - TENİS KORTU 1" → "Kalamış 1"
    var shortName: String {
        let parts = name.components(separatedBy: " - ")
        let place = (parts.first ?? name).components(separatedBy: " ").first ?? name
        let number = parts.count > 1 ? parts[1].split(separator: " ").last.flatMap { Int($0) } : nil
        let title = place.lowercased(with: .turkish).capitalized(with: .turkish)
        return number.map { "\(title) \($0)" } ?? title
    }

    /// "KALAMIŞ SPOR MERKEZİ" → "Kalamış Spor Merkezi"
    var facilityName: String {
        (name.components(separatedBy: " - ").first ?? name).lowercased(with: .turkish).capitalized(with: .turkish)
    }
}

struct Slot: Identifiable, Hashable {
    let court: Court
    let date: Date

    var id: String { "\(court.key)|\(date.timeIntervalSince1970)" }
    var isPrime: Bool { Istanbul.isPrime(date) }
}

extension Locale {
    static let turkish = Locale(identifier: "tr_TR")
}

enum Istanbul {
    static let timeZone = TimeZone(identifier: "Europe/Istanbul")!

    static var calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.locale = .turkish
        return calendar
    }()

    /// Slot strings are Istanbul wall-clock time without offset, e.g. 2026-09-28T18:00
    private static let slotFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm"
        return formatter
    }()

    static func parseSlot(_ value: String) -> Date? { slotFormatter.date(from: value) }

    /// Weekend or evening; same rule as isPrimeTime in the Lambda
    static func isPrime(_ date: Date) -> Bool {
        let weekday = calendar.component(.weekday, from: date) // 1 = Sunday, 7 = Saturday
        return weekday == 1 || weekday == 7 || calendar.component(.hour, from: date) >= 18
    }

    static func format(_ date: Date, _ template: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = .turkish
        formatter.timeZone = timeZone
        formatter.setLocalizedDateFormatFromTemplate(template)
        return formatter.string(from: date)
    }
}
