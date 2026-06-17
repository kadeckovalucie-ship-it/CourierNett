import SwiftUI
import UniformTypeIdentifiers

struct PreferencesView: View {
    @EnvironmentObject private var store: ShiftStore
    @State private var showingBackupImporter = false
    @State private var backupURL: URL?
    @State private var status = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Profil") {
                    TextField("Název profilu", text: $store.preferences.profileName)
                }

                Section("Tmavý a světlý režim") {
                    Picker("Barevný režim", selection: $store.preferences.theme) {
                        ForEach(AppTheme.allCases) { theme in
                            Text(theme.label).tag(theme)
                        }
                    }
                }

                Section("Data") {
                    Button("Vytvořit zálohu") {
                        do {
                            backupURL = try store.backupData()
                            status = "Záloha vytvořena. Sdílením ji ulož do Souborů."
                        } catch {
                            status = error.localizedDescription
                        }
                    }

                    if let backupURL {
                        ShareLink(item: backupURL) {
                            Label("Sdílet / uložit zálohu", systemImage: "square.and.arrow.up")
                        }
                    }

                    Button("Nahrát zálohu") {
                        showingBackupImporter = true
                    }
                }

                Section {
                    Button("Načíst zkušební data") {
                        store.createDemoData()
                        status = "Zkušební data načtena."
                    }
                } header: {
                    Text("Testování")
                } footer: {
                    Text("Ukázková data slouží jen pro vyzkoušení vzhledu a výpočtů.")
                }

                if !status.isEmpty {
                    Section { Text(status).foregroundStyle(.secondary) }
                }
            }
            .navigationTitle("Nastavení")
            .fileImporter(isPresented: $showingBackupImporter, allowedContentTypes: [.json]) { result in
                do {
                    let url = try result.get()
                    let access = url.startAccessingSecurityScopedResource()
                    defer { if access { url.stopAccessingSecurityScopedResource() } }
                    try store.importBackup(from: url)
                    status = "Záloha nahrána."
                } catch {
                    status = error.localizedDescription
                }
            }
        }
    }
}
