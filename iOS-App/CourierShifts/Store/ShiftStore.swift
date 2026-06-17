import Foundation
import SwiftUI

@MainActor
final class ShiftStore: ObservableObject {
    @Published var shifts: [CourierShift] = [] { didSet { save() } }
    @Published var expense = ExpenseSettings() { didSet { save() } }
    @Published var business = BusinessSettings() { didSet { save() } }
    @Published var preferences = AppPreferences() { didSet { save() } }
    @Published var selectedMonth: Date = .now

    private let fileName = "naklady-smen-ios-beta.json"
    private var isLoading = false

    init() {
        load()
        Task { await refreshFuelPriceIfOnline() }
    }

    func createDemoData() {
        shifts = CourierShift.demoShifts(for: selectedMonth)
        expense = ExpenseSettings(consumptionLitersPer100km: 10, fuelPricePerLiter: 39, vehicleRent: 4200)
        business = BusinessSettings(monthlyShiftCount: Double(shifts.count), flatExpenseRate: 0.8)
        preferences.profileName = "Název profilu"
    }

    func add(_ shift: CourierShift) {
        shifts.append(shift)
        sort()
    }

    func addOrMerge(date: Date, kilometers: Double? = nil, income: Double? = nil, hours: Double? = nil, title: String? = nil) {
        let services = ["Foodora", "Wolt", "Bolt"]
        let service = services.first { $0 == title }
        guard let service else { return }
        if let index = shifts.firstIndex(where: { Calendar.current.isDate($0.date, inSameDayAs: date) }) {
            if let kilometers { shifts[index].kilometers = kilometers }
            if let income { shifts[index].income = income }
            if let hours { shifts[index].hours = hours }
            shifts[index].title = service
        } else {
            add(CourierShift(
                date: date,
                title: service,
                kilometers: kilometers ?? 0,
                hours: hours ?? 0,
                income: income ?? 0
            ))
        }
        sort()
    }

    func update(_ shift: CourierShift) {
        guard let index = shifts.firstIndex(where: { $0.id == shift.id }) else { return }
        shifts[index] = shift
        sort()
    }

    func delete(_ shift: CourierShift) {
        shifts.removeAll { $0.id == shift.id }
    }

    func deleteMonth(_ month: Date) {
        shifts.removeAll { Calendar.current.isDate($0.date, equalTo: month, toGranularity: .month) }
    }

    func shifts(in month: Date? = nil) -> [CourierShift] {
        let date = month ?? selectedMonth
        return shifts
            .filter { Calendar.current.isDate($0.date, equalTo: date, toGranularity: .month) }
            .sorted { $0.date < $1.date }
    }

    func historyMonths() -> [Date] {
        let grouped = Dictionary(grouping: shifts, by: \.date.monthKey)
        let dates = grouped.keys.compactMap { key -> Date? in
            let parts = key.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 2 else { return nil }
            return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: 1))
        }
        return dates.sorted { preferences.historySortAscending ? $0 < $1 : $0 > $1 }
    }

    func totals(for month: Date? = nil) -> MonthTotals {
        let monthShifts = shifts(in: month)
        let income = monthShifts.reduce(0) { $0 + $1.income }
        let kilometers = monthShifts.reduce(0) { $0 + $1.kilometers }
        let hours = monthShifts.reduce(0) { $0 + $1.hours }
        let fuel = monthShifts.reduce(0) { $0 + breakdown(for: $1).fuelCost }
        let taxes = businessEstimate().monthlyReserve
        let rent = expense.vehicleRent
        let amortization = monthShifts.reduce(0) { $0 + $1.kilometers * expense.amortizationRatePerKm }
        return MonthTotals(income: income, kilometers: kilometers, hours: hours, fuel: fuel, taxes: taxes, rent: rent, amortization: amortization)
    }

    func breakdown(for shift: CourierShift) -> ShiftCostBreakdown {
        let fuelLiters = shift.kilometers * expense.consumptionLitersPer100km / 100
        let fuelCost = fuelLiters * expense.fuelPricePerLiter
        let monthHours = shifts(in: shift.date).reduce(0) { $0 + $1.hours }
        let osvcShare = monthHours > 0 ? businessEstimate().monthlyReserve / monthHours * shift.hours : 0
        let rentShare = monthHours > 0 ? expense.vehicleRent / monthHours * shift.hours : 0
        let amortizationShare = shift.kilometers * expense.amortizationRatePerKm
        let totalCost = fuelCost + osvcShare + rentShare + amortizationShare
        let profit = shift.income - totalCost
        return ShiftCostBreakdown(
            fuelLiters: fuelLiters,
            fuelCost: fuelCost,
            osvcShare: osvcShare,
            vehicleRentShare: rentShare,
            amortizationShare: amortizationShare,
            totalCost: totalCost,
            profit: profit,
            profitPerHour: shift.hours > 0 ? profit / shift.hours : nil,
            hourlyRevenue: shift.hours > 0 ? shift.income / shift.hours : nil
        )
    }

    func averageIncomePerShift() -> Double {
        let paid = shifts.filter { $0.income > 0 }
        guard !paid.isEmpty else { return 0 }
        return paid.reduce(0) { $0 + $1.income } / Double(paid.count)
    }

    func applyFuelType(_ fuelType: FuelType) {
        expense.fuelType = fuelType
        let average = expense.currentAverageFuelPrice
        if average > 0 {
            expense.fuelPricePerLiter = average
        }
    }

    func refreshFuelPriceIfOnline() async {
        guard let url = URL(string: "https://www.mbenzin.cz/") else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let html = String(data: data, encoding: .utf8),
                  let prices = Self.parseFuelPrices(from: html) else { return }
            expense.averageGasolinePrice = prices.gasoline
            expense.averageDieselPrice = prices.diesel
            expense.averageLpgPrice = prices.lpg
            expense.fuelPriceUpdatedAt = Date()
            let average = expense.currentAverageFuelPrice
            if average > 0 {
                expense.fuelPricePerLiter = average
            }
        } catch {
            // Offline režim nechává poslední uloženou cenu.
        }
    }

    func businessEstimate() -> BusinessEstimate {
        let monthlyRevenue = averageIncomePerShift() * business.monthlyShiftCount
        let annualRevenue = monthlyRevenue * 12
        let flatExpenses = min(annualRevenue * business.flatExpenseRate, 1_600_000)
        let profitBase = max(0, annualRevenue - flatExpenses)
        let incomeTax = calculateIncomeTax(profitBase)
        let social: Double
        let health: Double
        if business.isSideIncome {
            let sideIncomeSocialLimit = 117_521.0
            social = profitBase <= sideIncomeSocialLimit ? 0 : max(profitBase * 0.55 * 0.292, 1574 * 12)
            health = profitBase * 0.5 * 0.135
        } else {
            social = max(profitBase * 0.55 * 0.292, 5720 * 12)
            health = max(profitBase * 0.5 * 0.135, 3306 * 12)
        }
        return BusinessEstimate(
            monthlyRevenue: monthlyRevenue,
            annualRevenue: annualRevenue,
            monthlyIncomeTax: incomeTax / 12,
            monthlySocialInsurance: social / 12,
            monthlyHealthInsurance: health / 12,
            monthlyReserve: (incomeTax + social + health) / 12
        )
    }

    func backupData() throws -> URL {
        let data = try JSONEncoder.storage.encode(AppData(shifts: shifts, expense: expense, business: business, preferences: preferences))
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("naklady-smen-zaloha.json")
        try data.write(to: url, options: [.atomic])
        return url
    }

    func importBackup(from url: URL) throws {
        let data = try Data(contentsOf: url)
        let imported = try JSONDecoder.storage.decode(AppData.self, from: data)
        shifts = imported.shifts
        expense = imported.expense
        business = imported.business
        preferences = imported.preferences
        sort()
    }

    private func calculateIncomeTax(_ taxBase: Double) -> Double {
        let threshold = 48967 * 36.0
        return min(taxBase, threshold) * 0.15 + max(0, taxBase - threshold) * 0.23
    }

    private static func parseFuelPrices(from html: String) -> (gasoline: Double, diesel: Double, lpg: Double)? {
        guard let markerRange = html.range(of: "Aktuální průměrné ceny benzínu a nafty v ČR") else { return nil }
        let tail = html[markerRange.upperBound...]
        let normalized = tail
            .replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
        let matches = normalized.matches(of: /\d{1,3},\d{2}/).map { String($0.0) }
        guard matches.count >= 3,
              let gasoline = Double(matches[0].replacingOccurrences(of: ",", with: ".")),
              let diesel = Double(matches[1].replacingOccurrences(of: ",", with: ".")),
              let lpg = Double(matches[2].replacingOccurrences(of: ",", with: ".")) else { return nil }
        return (gasoline, diesel, lpg)
    }

    private func sort() {
        shifts.sort { $0.date < $1.date }
    }

    private func load() {
        isLoading = true
        defer { isLoading = false }
        let url = storageURL()
        guard FileManager.default.fileExists(atPath: url.path) else {
            shifts = []
            return
        }
        do {
            let data = try Data(contentsOf: url)
            let stored = try JSONDecoder.storage.decode(AppData.self, from: data)
            shifts = stored.shifts.sorted { $0.date < $1.date }
            expense = stored.expense
            business = stored.business
            preferences = stored.preferences
        } catch {
            shifts = []
        }
    }

    private func save() {
        guard !isLoading else { return }
        do {
            let data = try JSONEncoder.storage.encode(AppData(shifts: shifts, expense: expense, business: business, preferences: preferences))
            try data.write(to: storageURL(), options: [.atomic])
        } catch {
            assertionFailure("Save failed: \(error.localizedDescription)")
        }
    }

    private func storageURL() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent(fileName)
    }
}

private extension JSONEncoder {
    static var storage: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}

private extension JSONDecoder {
    static var storage: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
