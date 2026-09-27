import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: SlotStore
    @EnvironmentObject private var preferences: Preferences
    @EnvironmentObject private var push: PushRegistrar
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Sadece akşam ve hafta sonu", isOn: $preferences.primeOnly)
                } footer: {
                    Text("Açıksa yalnız 18:00 sonrası ve cumartesi-pazar slotları için bildirim gelir.")
                }

                Section {
                    ForEach(store.courts) { court in
                        Toggle(isOn: Binding(
                            get: { preferences.isSelected(court) },
                            set: { preferences.setSelected($0, court: court, allCourts: store.courts) }
                        )) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(court.shortName)
                                Text(court.facilityName).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                } header: {
                    Text("Kortlar")
                } footer: {
                    Text("Seçili kortlarda yeni slot açılınca bildirim gelir. En az bir kort seçili kalmalı.")
                }

                Section {
                    LabeledContent("Bildirim izni", value: authorizationText)
                    if push.lastSyncFailed {
                        Label("Ayarlar sunucuya kaydedilemedi", systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Bildirimler")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button("Tamam") { dismiss() }
            }
        }
    }

    private var authorizationText: String {
        switch push.authorization {
        case .authorized, .provisional, .ephemeral: return "Açık"
        case .denied: return "Kapalı (Ayarlar'dan aç)"
        default: return "Sorulmadı"
        }
    }
}
