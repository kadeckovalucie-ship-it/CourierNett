import Foundation
import PDFKit

enum PDFImportError: LocalizedError {
    case unreadablePDF
    case noText
    case noShifts

    var errorDescription: String? {
        switch self {
        case .unreadablePDF: "PDF se nepodarilo otevrit."
        case .noText: "V PDF se nepodarilo najit citelny text."
        case .noShifts: "V PDF se nepodarilo najit smeny ani kilometry."
        }
    }
}

struct PDFShiftImporter {
    func importShifts(from url: URL) throws -> [CourierShift] {
        guard let document = PDFDocument(url: url) else { throw PDFImportError.unreadablePDF }
        let text = (0..<document.pageCount)
            .compactMap { document.page(at: $0)?.string }
            .joined(separator: "\n")
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw PDFImportError.noText
        }
        let shifts = PDFShiftTextParser.parse(text)
        guard !shifts.isEmpty else { throw PDFImportError.noShifts }
        return shifts
    }
}

enum PDFShiftTextParser {
    static func parse(_ text: String) -> [CourierShift] {
        let lines = importLines(from: text)

        let compactedShifts = parseVehicleLogText(text)
        if !compactedShifts.isEmpty { return groupByDay(compactedShifts) }

        let tableShifts = parseVehicleLogRows(lines)
        if !tableShifts.isEmpty { return groupByDay(tableShifts) }

        let parsed = lines.compactMap(parseLine)
        if !parsed.isEmpty { return groupByDay(parsed) }

        if let kilometers = detectKilometers(in: text) {
            return [CourierShift(date: detectDate(in: text) ?? .now, title: "", kilometers: kilometers, hours: 0, income: 0)]
        }
        return []
    }

    private static func parseVehicleLogText(_ text: String) -> [CourierShift] {
        let compacted = normalized(text)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let pattern = #"sluzebni\s+(\d{1,2}[.\/-]\s*\d{1,2}(?:[.\/-]\s*\d{2,4})?)\s+\d{1,2}:\d{2}\s+\d{1,2}[.\/-]\s*\d{1,2}(?:[.\/-]\s*\d{2,4})?\s+\d{1,2}:\d{2}\s+\d+(?:[,.]\d+)?\s+(\d+(?:[,.]\d+)?)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let range = NSRange(compacted.startIndex..<compacted.endIndex, in: compacted)

        return regex.matches(in: compacted, range: range).compactMap { match in
            guard let dateRange = Range(match.range(at: 1), in: compacted),
                  let kilometersRange = Range(match.range(at: 2), in: compacted),
                  let date = detectDate(in: String(compacted[dateRange])),
                  let kilometers = Double(String(compacted[kilometersRange]).replacingOccurrences(of: ",", with: ".")),
                  kilometers > 0,
                  kilometers < 1_000 else { return nil }
            return CourierShift(
                date: date,
                title: "",
                kilometers: kilometers,
                hours: 0,
                income: 0,
                notes: "Import z PDF"
            )
        }
    }

    private static func importLines(from text: String) -> [String] {
        text
            .split(separator: "\n")
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private static func parseVehicleLogRows(_ lines: [String]) -> [CourierShift] {
        var shifts: [CourierShift] = []

        for index in lines.indices where normalized(lines[index]).contains("sluzebni") {
            let end = min(index + 12, lines.count)
            let window = Array(lines[(index + 1)..<end])
            var rowDate: Date?
            var dateCount = 0
            var rowNumbers: [Double] = []

            for line in window {
                if let date = detectDate(in: line) {
                    rowDate = rowDate ?? date
                    dateCount += 1
                    continue
                }

                guard dateCount >= 2 else { continue }
                if let number = standaloneNumber(in: line) {
                    rowNumbers.append(number)
                    if rowNumbers.count >= 2 { break }
                }
            }

            guard let rowDate, rowNumbers.count >= 2 else { continue }
            let kilometers = rowNumbers[1]
            guard kilometers > 0, kilometers < 1_000 else { continue }
            shifts.append(CourierShift(
                date: rowDate,
                title: detectTitle(in: lines[index]),
                kilometers: kilometers,
                hours: 0,
                income: 0,
                notes: "Import z PDF"
            ))
        }

        return shifts
    }

    private static func groupByDay(_ shifts: [CourierShift]) -> [CourierShift] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: shifts) { calendar.startOfDay(for: $0.date) }

        return grouped
            .map { day, dayShifts in
                CourierShift(
                    date: day,
                    title: dayShifts.first?.title ?? "",
                    kilometers: dayShifts.reduce(0) { $0 + $1.kilometers },
                    hours: dayShifts.reduce(0) { $0 + $1.hours },
                    income: dayShifts.reduce(0) { $0 + $1.income },
                    notes: "Import z PDF: \(dayShifts.count) jizd"
                )
            }
            .sorted { $0.date < $1.date }
    }

    private static func parseLine(_ line: String) -> CourierShift? {
        guard let kilometers = detectKilometers(in: line),
              let date = detectDate(in: line) else { return nil }
        return CourierShift(
            date: date,
            title: detectTitle(in: line),
            kilometers: kilometers,
            hours: 0,
            income: 0,
            notes: "Import z PDF: \(line)"
        )
    }

    private static func detectTitle(in line: String) -> String {
        let lower = normalized(line)
        if lower.contains("foodora") { return "Foodora" }
        if lower.contains("wolt") { return "Wolt" }
        if lower.contains("bolt") { return "Bolt" }
        return ""
    }

    private static func detectKilometers(in text: String) -> Double? {
        firstNumber(in: text, patterns: [
            #"(?i)(?:celkem|ujeto|vzdalenost|kilometry|km)\s*:?\s*(\d+(?:[,.]\d+)?)\s*(?:km)?"#,
            #"(?i)(\d+(?:[,.]\d+)?)\s*km"#,
            #"(?i)km\s*:?\s*(\d+(?:[,.]\d+)?)"#
        ])
    }

    private static func detectDate(in text: String) -> Date? {
        let pattern = #"(?<!\d)(\d{1,2})[.\/-]\s*(\d{1,2})(?:[.\/-]\s*(\d{2,4}))?\.?(?!\d)"#
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: range),
              let dayRange = Range(match.range(at: 1), in: text),
              let monthRange = Range(match.range(at: 2), in: text),
              let day = Int(text[dayRange]),
              let month = Int(text[monthRange]) else { return nil }
        guard (1...31).contains(day), (1...12).contains(month) else { return nil }
        let year: Int
        if match.range(at: 3).location != NSNotFound,
           let yearRange = Range(match.range(at: 3), in: text),
           let parsed = Int(text[yearRange]) {
            year = parsed < 100 ? 2000 + parsed : parsed
        } else {
            year = Calendar.current.component(.year, from: .now)
        }
        return Calendar.current.date(from: DateComponents(year: year, month: month, day: day))
    }

    private static func standaloneNumber(in text: String) -> Double? {
        let pattern = #"^\d+(?:[,.]\d+)?$"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              regex.firstMatch(in: text, range: NSRange(text.startIndex..<text.endIndex, in: text)) != nil else {
            return nil
        }
        return Double(text.replacingOccurrences(of: ",", with: "."))
    }

    private static func firstNumber(in text: String, patterns: [String]) -> Double? {
        let normalizedText = normalized(text)
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { continue }
            let range = NSRange(normalizedText.startIndex..<normalizedText.endIndex, in: normalizedText)
            guard let match = regex.firstMatch(in: normalizedText, range: range),
                  let valueRange = Range(match.range(at: 1), in: normalizedText) else { continue }
            if let number = Double(String(normalizedText[valueRange]).replacingOccurrences(of: ",", with: ".")) {
                return number
            }
        }
        return nil
    }

    private static func normalized(_ text: String) -> String {
        text
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "cs_CZ"))
            .lowercased()
    }
}
