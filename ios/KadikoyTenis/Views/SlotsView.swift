import SwiftUI

struct SlotsView: View {
    @EnvironmentObject private var store: SlotStore
    @EnvironmentObject private var preferences: Preferences
    @EnvironmentObject private var push: PushRegistrar
    @Environment(\.scenePhase) private var scenePhase
    @State private var onlyMine = false
    @State private var showSettings = false

    private var visibleSlots: [Slot] {
        onlyMine ? store.slots.filter(preferences.matches) : store.slots
    }

    /// Slots grouped by Istanbul day, in order
    private var days: [(day: Date, slots: [Slot])] {
        let grouped = Dictionary(grouping: visibleSlots) { Istanbul.calendar.startOfDay(for: $0.date) }
        return grouped.keys.sorted().map { ($0, grouped[$0]!) }
    }

    var body: some View {
        NavigationStack {
            List {
                if push.authorization == .notDetermined || push.authorization == .denied {
                    NotificationPrompt()
                }
                Picker("Gösterim", selection: $onlyMine) {
                    Text("Tüm kortlar").tag(false)
                    Text("Filtrem").tag(true)
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())

                if store.snapshot != nil && visibleSlots.isEmpty {
                    ContentUnavailableView(
                        "Şu an boş kort yok",
                        systemImage: "tennis.racket",
                        description: Text("Kortlar 2 dakikada bir kontrol ediliyor. Boşalınca bildirim gelir.")
                    )
                    .listRowBackground(Color.clear)
                }

                ForEach(days, id: \.day) { day in
                    Section(dayTitle(day.day)) {
                        ForEach(day.slots) { slot in
                            // Opens the court's calendar on the site, ready to add the slot to the cart
                            Link(destination: slot.court.calendarURL) { SlotRow(slot: slot) }
                                .foregroundStyle(.primary)
                        }
                    }
                }

                Section {
                    Link(destination: AppConfig.reservationURL) {
                        Label("Rezervasyon sitesini aç", systemImage: "safari")
                    }
                } footer: {
                    if let updatedAt = store.snapshot?.updatedAt {
                        Text("Son kontrol: \(min(updatedAt, Date()).formatted(.relative(presentation: .named)))")
                    }
                }
            }
            .overlay {
                if let error = store.errorMessage, store.snapshot == nil {
                    ContentUnavailableView(error, systemImage: "wifi.exclamationmark", description: Text("Aşağı çekerek yenile"))
                } else if store.snapshot == nil {
                    ProgressView()
                }
            }
            .navigationTitle("Kadıköy Tenis")
            .toolbar {
                Button {
                    showSettings = true
                } label: {
                    Image(systemName: "bell.badge")
                }
                .accessibilityLabel("Bildirim ayarları")
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
            }
            .refreshable { await store.load() }
        }
        .task { await push.refreshAuthorization() }
        .task(id: scenePhase) {
            // Refresh when the app comes to the foreground, then every minute while open
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                await store.load()
                try? await Task.sleep(for: .seconds(60))
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .slotsChanged)) { _ in
            Task { await store.load() }
        }
    }

    private func dayTitle(_ day: Date) -> String {
        let calendar = Istanbul.calendar
        let name = Istanbul.format(day, "EEEE d MMMM")
        if calendar.isDateInToday(day) { return "Bugün · \(name)" }
        if calendar.isDateInTomorrow(day) { return "Yarın · \(name)" }
        return name
    }
}

private struct SlotRow: View {
    let slot: Slot

    var body: some View {
        HStack(spacing: 12) {
            Text(Istanbul.format(slot.date, "HH:mm"))
                .font(.title3.monospacedDigit().weight(.semibold))
                .frame(width: 64, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(slot.court.shortName).font(.body.weight(.medium))
                Text(slot.court.facilityName).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if slot.isPrime {
                Image(systemName: "star.fill")
                    .foregroundStyle(.orange)
                    .accessibilityLabel("Akşam veya hafta sonu")
            }
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}

private struct NotificationPrompt: View {
    @EnvironmentObject private var push: PushRegistrar

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Bildirimler kapalı", systemImage: "bell.slash").font(.headline)
            Text("Boşalan kortları kaçırmamak için bildirimleri aç.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button(push.authorization == .denied ? "Ayarları aç" : "Bildirimleri aç") {
                if push.authorization == .denied, let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                } else {
                    Task { await push.requestAuthorization() }
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(.vertical, 4)
    }
}
