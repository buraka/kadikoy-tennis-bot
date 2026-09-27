import Foundation

@MainActor
final class SlotStore: ObservableObject {
    @Published private(set) var snapshot: Snapshot?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    var courts: [Court] { snapshot?.courts ?? [] }

    /// Future slots of every court, soonest first
    var slots: [Slot] {
        let now = Date()
        return courts
            .flatMap { court in court.availableSlots.compactMap { Istanbul.parseSlot($0) }.map { Slot(court: court, date: $0) } }
            .filter { $0.date > now }
            .sorted { ($0.date, $0.court.name) < ($1.date, $1.court.name) }
    }

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        decoder.dateDecodingStrategy = .custom { decoder in
            let value = try decoder.singleValueContainer().decode(String.self)
            if let date = withFraction.date(from: value) ?? plain.date(from: value) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "bad date \(value)"))
        }
        return decoder
    }()

    func load() async {
        guard let url = AppConfig.slotsURL else {
            errorMessage = "Sunucu adresi ayarlanmamış"
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            var request = URLRequest(url: url)
            request.cachePolicy = .reloadIgnoringLocalCacheData
            let (data, _) = try await URLSession.shared.data(for: request)
            snapshot = try decoder.decode(Snapshot.self, from: data)
            errorMessage = nil
        } catch is CancellationError {
        } catch {
            errorMessage = "Kort durumu alınamadı"
        }
    }
}
