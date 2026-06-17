import SwiftUI

@main
struct CourierShiftsApp: App {
    @StateObject private var store = ShiftStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
        }
    }
}
