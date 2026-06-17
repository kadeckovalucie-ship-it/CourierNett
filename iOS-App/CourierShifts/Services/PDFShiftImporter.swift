import Foundation
import PDFKit

enum PDFImportError: LocalizedError {
    case unreadablePDF
    case noText
    case noShifts

    var errorDescription: String? {
        switch self {
        case .unreadablePDF: "PDF se nepodařilo otevřít."
        case .noText: "V PDF se nepodařilo najít čitelný text."
        case .noShifts: "V PDF se nepodařilo najít směny ani kilometry."
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
        let lines = text
            .split(separator: "\n")
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        let parsed = lines.compactMap(parseLine)
        if !parsed.isEmpty { return parsed }

        if let kilometers = detectKilometers(in: text) {
            return [CourierShift(date: .now, title: "", kilometers: kilometers, hours: 0, income: 0)]
        }
        return []
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
        let lower = line.lowercased()
        if lower.contains("foodora") { return "Foodora" }
        if lower.contains("wolt") { return "Wolt" }
        if lower.contains("bolt") { return "Bolt" }
        return ""
    }

    private static func detectKilometers(in text: String) -> Double? {
        firstNumber(in: text, patterns: [
            #"(?i)(\d+(?:[,.]\d+)?)\s*km"#,
            #"(?i)km\s*:?\s*(\d+(?:[,.]\d+)?)"#,
            #"(?i)kilometr(?:y|u|ů|u)?\s*:?\s*(\d+(?:[,.]\d+)?)"#
        ])
    }

    private static func detectDate(in text: String) -> Date? {
        let pattern = #"(?<!\d)(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?(?!\d)"#
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: range),
              let dayRange = Range(match.range(at: 1), in: text),
              let monthRange = Range(match.range(at: 2), in: text),
              let day = Int(text[dayRange]),
              let month = Int(text[monthRange]) else { return nil }
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

    private static func firstNumber(in text: String, patterns: [String]) -> Double? {
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { continue }
            let range = NSRange(text.startIndex..<text.endIndex, in: text)
            guard let match = regex.firstMatch(in: text, range: range),
                  let valueRange = Range(match.range(at: 1), in: text) else { continue }
            if let number = Double(String(text[valueRange]).replacingOccurrences(of: ",", with: ".")) {
                return number
            }
        }
        return nil
    }
}
