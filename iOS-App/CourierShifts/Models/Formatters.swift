import Foundation

extension Double {
    var money: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "CZK"
        formatter.locale = Locale(identifier: "cs_CZ")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: self)) ?? "\(self) Kc"
    }

    var kilometersText: String {
        String(format: "%.1f km", locale: Locale(identifier: "cs_CZ"), self)
    }

    var hoursText: String {
        self > 0 ? String(format: "%.2f h", locale: Locale(identifier: "cs_CZ"), self) : "0 h"
    }

    var inputText: String {
        String(format: "%.2f", locale: Locale(identifier: "cs_CZ"), self)
            .replacingOccurrences(of: ",00", with: "")
    }
}

extension Date {
    var monthKey: String {
        Self.monthKeyFormatter.string(from: self)
    }

    var dayLabel: String {
        Self.dayFormatter.string(from: self)
    }

    var shortMonthLabel: String {
        let value = Self.shortMonthFormatter.string(from: self)
        return value.prefix(1).uppercased() + value.dropFirst()
    }

    var pdfMonthTitle: String {
        let value = Self.pdfMonthFormatter.string(from: self)
        return value.prefix(1).uppercased() + value.dropFirst()
    }

    private static let monthKeyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = .current
        formatter.dateFormat = "yyyy-MM"
        return formatter
    }()

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "cs_CZ")
        formatter.dateFormat = "d. M."
        return formatter
    }()

    private static let shortMonthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "cs_CZ")
        formatter.dateFormat = "LLLL yy"
        return formatter
    }()

    private static let pdfMonthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "cs_CZ")
        formatter.dateFormat = "LLLL yyyy"
        return formatter
    }()
}

func parseNumber(_ text: String) -> Double {
    Double(text.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0
}
