import SwiftUI

struct ShiftListView: View {
    @EnvironmentObject private var store: ShiftStore
    @State private var selectedMonth: Date?
    @State private var selectedShift: CourierShift?
    @State private var monthToDelete: Date?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    sortCard

                    ForEach(store.historyMonths(), id: \.monthKey) { month in
                        HistoryMonthCard(
                            month: month,
                            totals: store.totals(for: month),
                            open: { selectedMonth = month },
                            delete: { monthToDelete = month }
                        )
                    }

                    if store.historyMonths().isEmpty {
                        Text("Zatím tu není žádný uložený přehled.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding(.top, 32)
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Historie")
            .alert("Smazat přehled?", isPresented: Binding(
                get: { monthToDelete != nil },
                set: { if !$0 { monthToDelete = nil } }
            )) {
                Button("Smazat", role: .destructive) {
                    if let monthToDelete {
                        store.deleteMonth(monthToDelete)
                    }
                    monthToDelete = nil
                }
                Button("Zrušit", role: .cancel) {
                    monthToDelete = nil
                }
            } message: {
                Text("Smaže se celý měsíční přehled včetně směn.")
            }
            .sheet(item: Binding(
                get: { selectedMonth.map(MonthSelection.init(date:)) },
                set: { selectedMonth = $0?.date }
            )) { item in
                MonthDetailView(month: item.date, selectedShift: $selectedShift)
            }
            .sheet(item: $selectedShift) { shift in
                ShiftDetailView(shift: shift)
            }
        }
    }

    private var sortCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("Řazení")
                    .font(.headline)
                Text(store.preferences.historySortAscending ? "Od nejstaršího" : "Od nejnovějšího")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Toggle("Od nejstaršího", isOn: $store.preferences.historySortAscending)
                .labelsHidden()
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct HistoryMonthCard: View {
    let month: Date
    let totals: MonthTotals
    let open: () -> Void
    let delete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button(action: open) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(month.shortMonthLabel)
                            .font(.title3.bold())
                        Spacer()
                        Text(totals.profit.money)
                            .font(.title3.bold())
                            .foregroundStyle(totals.profit >= 0 ? .green : .red)
                    }

                    HStack {
                        HistoryValue(title: "Km", value: totals.kilometers.kilometersText)
                        HistoryValue(title: "Náklady/km", value: (totals.fuel + totals.amortization).money)
                        HistoryValue(title: "Hodiny", value: totals.hours.hoursText)
                        HistoryValue(title: "Obrat", value: totals.income.money)
                    }
                }
            }
            .buttonStyle(.plain)

            HStack {
                Spacer()
                Button(action: delete) {
                    Image(systemName: "trash")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.red.opacity(0.8))
                        .frame(width: 36, height: 30)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct HistoryValue: View {
    let title: String
    let value: String

    var body: some View {
        VStack {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption.bold())
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct MonthSelection: Identifiable {
    var id: String { date.monthKey }
    let date: Date
}

private struct MonthDetailView: View {
    @EnvironmentObject private var store: ShiftStore
    let month: Date
    @Binding var selectedShift: CourierShift?

    var body: some View {
        NavigationStack {
            List {
                ForEach(store.shifts(in: month)) { shift in
                    Button {
                        selectedShift = shift
                    } label: {
                        HStack {
                            Text(shift.date.dayLabel)
                            Text(shift.title)
                            Spacer()
                            Text(store.breakdown(for: shift).profit.money)
                                .fontWeight(.semibold)
                        }
                    }
                }
            }
            .navigationTitle(month.shortMonthLabel)
        }
    }
}
