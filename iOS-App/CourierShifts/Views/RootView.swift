import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: ShiftStore

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Přehled", systemImage: "square.grid.2x2") }

            ShiftListView()
                .tabItem { Label("Historie", systemImage: "clock") }

            ImportView()
                .tabItem { Label("Import", systemImage: "tray.and.arrow.down") }

            SettingsView()
                .tabItem { Label("Náklady", systemImage: "fuelpump") }

            PreferencesView()
                .tabItem { Label("Nastavení", systemImage: "gearshape") }
        }
        .tint(.teal)
        .preferredColorScheme(colorScheme)
    }

    private var colorScheme: ColorScheme? {
        switch store.preferences.theme {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}
