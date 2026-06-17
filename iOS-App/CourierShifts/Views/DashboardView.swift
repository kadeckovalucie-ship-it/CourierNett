import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var store: ShiftStore
    @State private var showingEditor = false
    @State private var selectedShift: CourierShift?
    @State private var showingPDF = false
    @State private var showingMonthPicker = false
    @State private var selectedServices = Set(DashboardServiceFilter.services)

    private var shifts: [CourierShift] { store.shifts(in: store.selectedMonth) }
    private var displayedShifts: [CourierShift] {
        shifts.filter { selectedServices.contains($0.title) }
    }
    private var totals: MonthTotals { totals(for: displayedShifts) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    monthHeader
                    serviceFilter
                    metricGrid
                    PerformanceChart(shifts: displayedShifts, selectedShift: $selectedShift)
                    shiftsGrid
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(store.preferences.profileName)
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingEditor) {
                ShiftEditorView(mode: .create) { store.add($0) }
            }
            .sheet(item: $selectedShift) { shift in
                ShiftDetailView(shift: shift)
            }
            .sheet(isPresented: $showingPDF) {
                ShareSheet(items: [PDFExporter.makePDF(month: store.selectedMonth, shifts: displayedShifts, totals: totals, profileName: store.preferences.profileName)])
            }
            .sheet(isPresented: $showingMonthPicker) {
                MonthYearPickerSheet(selectedMonth: $store.selectedMonth)
            }
        }
    }

    private var monthHeader: some View {
        HStack(spacing: 8) {
            Button {
                showingMonthPicker = true
            } label: {
                HeaderTile(title: store.selectedMonth.shortMonthLabel, style: .plain)
            }
            .buttonStyle(.plain)

            Button {
                store.selectedMonth = store.selectedMonth.nextMonthStart
            } label: {
                HeaderTile(title: "Nový přehled", style: .primary)
            }
            .buttonStyle(.plain)

            Button {
                showingPDF = true
            } label: {
                HeaderTile(title: "Export PDF", style: .secondary)
            }
            .buttonStyle(.plain)
        }
    }

    private var serviceFilter: some View {
        HStack(spacing: 7) {
            ServiceFilterChip(
                title: "Vše",
                isSelected: selectedServices.count == DashboardServiceFilter.services.count
            ) {
                selectedServices = Set(DashboardServiceFilter.services)
            }

            ForEach(DashboardServiceFilter.services, id: \.self) { service in
                ServiceFilterChip(
                    title: service,
                    isSelected: selectedServices.contains(service)
                ) {
                    toggleService(service)
                }
            }
        }
        .padding(6)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var metricGrid: some View {
        VStack(spacing: 7) {
            HStack(spacing: 7) {
                MetricTile(title: "Příjem", value: totals.income.money)
                MetricTile(title: "Čistý zisk / h", value: totals.profitPerHour?.money ?? "Bez hodin", highlighted: totals.profit >= 0)
                MetricTile(title: "Čistý zisk", value: totals.profit.money, highlighted: totals.profit >= 0)
            }
            HStack(spacing: 7) {
                MetricTile(title: "Kilometry", value: totals.kilometers.kilometersText)
                MetricTile(title: "Náklady na km", value: (totals.fuel + totals.amortization).money)
            }
            HStack(spacing: 7) {
                MetricTile(title: "OSVČ odvody", value: totals.taxes.money)
                if store.expense.vehicleRent > 0 {
                    MetricTile(title: "Pronájem vozidla", value: totals.rent.money)
                }
                MetricTile(title: "Výdaje celkem", value: totals.costs.money)
            }
        }
    }

    private var shiftsGrid: some View {
        VStack(spacing: 8) {
            Text("Směny")
                .font(.headline)
                .frame(maxWidth: .infinity)

            LazyVGrid(columns: Array(repeating: GridItem(.fixed(48), spacing: 7), count: 6), spacing: 7) {
                Button {
                    showingEditor = true
                } label: {
                    Image(systemName: "plus")
                        .font(.title2.bold())
                        .frame(width: 48, height: 48)
                        .foregroundStyle(.white)
                        .background(.teal, in: RoundedRectangle(cornerRadius: 8))
                }

                ForEach(displayedShifts) { shift in
                    Button {
                        selectedShift = shift
                    } label: {
                        Text(shift.date.dayLabel)
                            .font(.caption.bold())
                            .frame(width: 48, height: 48)
                            .background(tileBackground(for: shift), in: RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.25)))
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(10)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private func tileBackground(for shift: CourierShift) -> Color {
        guard let high = displayedShifts.max(by: { hourlyRevenue($0) < hourlyRevenue($1) }),
              let low = displayedShifts.min(by: { hourlyRevenue($0) < hourlyRevenue($1) }) else {
            return Color(.systemBackground)
        }
        if shift.id == high.id { return Color.yellow.opacity(0.25) }
        if shift.id == low.id { return Color.red.opacity(0.16) }
        return Color(.systemBackground)
    }

    private func toggleService(_ service: String) {
        if selectedServices.count == DashboardServiceFilter.services.count {
            selectedServices = [service]
            return
        }

        if selectedServices.contains(service), selectedServices.count > 1 {
            selectedServices.remove(service)
        } else {
            selectedServices.insert(service)
        }
    }

    private func totals(for shifts: [CourierShift]) -> MonthTotals {
        let income = shifts.reduce(0) { $0 + $1.income }
        let kilometers = shifts.reduce(0) { $0 + $1.kilometers }
        let hours = shifts.reduce(0) { $0 + $1.hours }
        let breakdowns = shifts.map { store.breakdown(for: $0) }
        let fuel = breakdowns.reduce(0) { $0 + $1.fuelCost }
        let taxes = breakdowns.reduce(0) { $0 + $1.osvcShare }
        let rent = breakdowns.reduce(0) { $0 + $1.vehicleRentShare }
        let amortization = breakdowns.reduce(0) { $0 + $1.amortizationShare }
        return MonthTotals(income: income, kilometers: kilometers, hours: hours, fuel: fuel, taxes: taxes, rent: rent, amortization: amortization)
    }

    private func hourlyRevenue(_ shift: CourierShift) -> Double {
        shift.hours > 0 ? shift.income / shift.hours : 0
    }
}

private enum DashboardServiceFilter {
    static let services = ["Wolt", "Foodora", "Bolt"]
}

private struct ServiceFilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.78)
                .frame(maxWidth: .infinity, minHeight: 34)
                .foregroundStyle(isSelected ? .white : .primary)
                .background(isSelected ? Color.teal : Color(.systemBackground), in: Capsule())
        }
        .buttonStyle(.plain)
    }
}

private struct HeaderTile: View {
    enum TileStyle {
        case plain
        case primary
        case secondary
    }

    let title: String
    let style: TileStyle

    var body: some View {
        Text(title)
            .font(.system(size: 17, weight: .bold))
            .multilineTextAlignment(.center)
            .lineLimit(2)
            .minimumScaleFactor(0.72)
            .frame(maxWidth: .infinity, minHeight: 58)
            .padding(.horizontal, 6)
            .foregroundStyle(foreground)
            .background(background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(border, lineWidth: 1)
            )
    }

    private var background: Color {
        switch style {
        case .plain:
            Color(.systemBackground)
        case .primary:
            Color.teal
        case .secondary:
            Color(red: 0.11, green: 0.40, blue: 0.50)
        }
    }

    private var foreground: Color {
        switch style {
        case .plain:
            .primary
        case .primary, .secondary:
            .white
        }
    }

    private var border: Color {
        switch style {
        case .plain:
            Color.secondary.opacity(0.2)
        case .primary, .secondary:
            Color.clear
        }
    }
}

struct MonthYearPickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var selectedMonth: Date
    @State private var month: Int
    @State private var year: Int

    private let years = Array(2024...2035)
    private let monthNames = [
        "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
        "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"
    ]

    init(selectedMonth: Binding<Date>) {
        _selectedMonth = selectedMonth
        let components = Calendar.current.dateComponents([.month, .year], from: selectedMonth.wrappedValue)
        _month = State(initialValue: components.month ?? 1)
        _year = State(initialValue: components.year ?? Calendar.current.component(.year, from: .now))
    }

    var body: some View {
        NavigationStack {
            HStack {
                Picker("Měsíc", selection: $month) {
                    ForEach(1...12, id: \.self) { value in
                        Text(monthNames[value - 1]).tag(value)
                    }
                }
                .pickerStyle(.wheel)

                Picker("Rok", selection: $year) {
                    ForEach(years, id: \.self) { value in
                        Text(String(value)).tag(value)
                    }
                }
                .pickerStyle(.wheel)
            }
            .padding()
            .navigationTitle("Měsíc přehledu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Zrušit") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Hotovo") {
                        selectedMonth = Calendar.current.date(from: DateComponents(year: year, month: month, day: 1)) ?? selectedMonth
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

private extension Date {
    var monthStart: Date {
        let components = Calendar.current.dateComponents([.year, .month], from: self)
        return Calendar.current.date(from: components) ?? self
    }

    var nextMonthStart: Date {
        Calendar.current.date(byAdding: .month, value: 1, to: monthStart) ?? self
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    var highlighted: Bool = false

    var body: some View {
        VStack(spacing: 5) {
            Text(title)
                .font(.caption)
                .foregroundStyle(highlighted ? .white.opacity(0.82) : .secondary)
                .multilineTextAlignment(.center)
            Text(value)
                .font(.headline.bold())
                .minimumScaleFactor(0.65)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, minHeight: 62)
        .padding(8)
        .background(highlighted ? Color.green : Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
        .foregroundStyle(highlighted ? .white : .primary)
    }
}
