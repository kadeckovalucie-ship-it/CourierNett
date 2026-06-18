import Foundation
import UIKit
import Vision

struct EarningsImportResult: Identifiable {
    let id = UUID()
    var date: Date
    var income: Double
    var hours: Double?
    var recognizedText: String
}

enum EarningsScreenshotImportError: LocalizedError {
    case missingImage
    case textNotFound
    case incomeNotFound

    var errorDescription: String? {
        switch self {
        case .missingImage: "Obrazek se nepodarilo otevrit."
        case .textNotFound: "V obrazku se nepodarilo precist text."
        case .incomeNotFound: "V obrazku se nepodarilo najit vydelek."
        }
    }
}

struct EarningsScreenshotImporter {
    func importEarnings(from image: UIImage) async throws -> EarningsImportResult {
        guard let cgImage = image.cgImage else { throw EarningsScreenshotImportError.missingImage }
        let text = try await recognizeText(in: cgImage)
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw EarningsScreenshotImportError.textNotFound
        }
        guard let income = EarningsTextParser.detectIncome(in: text) else {
            throw EarningsScreenshotImportError.incomeNotFound
        }
        return EarningsImportResult(
            date: EarningsTextParser.detectDate(in: text) ?? .now,
            income: income,
            hours: EarningsTextParser.detectHours(in: text),
            recognizedText: text
        )
    }

    private func recognizeText(in image: CGImage) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let text = (request.results as? [VNRecognizedTextObservation] ?? [])
                    .compactMap { $0.topCandidates(1).first?.string }
                    .joined(separator: "\n")
                continuation.resume(returning: text)
            }
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["cs-CZ", "en-US"]
            request.usesLanguageCorrection = true
            do {
                try VNImageRequestHandler(cgImage: image).perform([request])
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
}

enum EarningsTextParser {
    static func detectIncome(in text: String) -> Double? {
        let lines = importLines(from: text)
        if let total = preferredCurrencyValue(after: "celkovy prijem", in: lines) {
            return total
        }

        let candidates = lines
            .flatMap(currencyNumbersWithContext)
            .sorted { lhs, rhs in
                lhs.score == rhs.score ? lhs.value > rhs.value : lhs.score > rhs.score
            }
        return candidates.first?.value
    }

    static func detectDate(in text: String) -> Date? {
        let pattern = #"(?<!\d)(\d{1,2})[.\/-]\s*(\d{1,2})(?:[.\/-]\s*(\d{2,4}))?\.?(?!\d)"#
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        if let regex = try? NSRegularExpression(pattern: pattern),
           let match = regex.firstMatch(in: text, range: range),
           let dayRange = Range(match.range(at: 1), in: text),
           let monthRange = Range(match.range(at: 2), in: text),
           let day = Int(text[dayRange]),
           let month = Int(text[monthRange]) {
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

        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue)
        if let detected = detector?.matches(in: text, range: range).compactMap(\.date).first {
            return detected
        }
        return nil
    }

    static func detectHours(in text: String) -> Double? {
        let lines = importLines(from: text)
        if let drivenHours = preferredHours(afterAnyOf: ["odjezd", "odjezdene hodiny"], in: lines) {
            return drivenHours
        }

        return lines
            .flatMap(hoursWithContext)
            .sorted { $0.score == $1.score ? $0.value > $1.value : $0.score > $1.score }
            .first?.value
    }

    private static func importLines(from text: String) -> [String] {
        text
            .split(separator: "\n")
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private static func preferredCurrencyValue(after label: String, in lines: [String]) -> Double? {
        for index in lines.indices where normalized(lines[index]).contains(label) {
            let end = min(index + 3, lines.count)
            let candidates = lines[index..<end]
                .flatMap(currencyNumbersWithContext)
                .filter { $0.value >= 50 }
                .sorted { lhs, rhs in
                    lhs.score == rhs.score ? lhs.value > rhs.value : lhs.score > rhs.score
                }
            if let value = candidates.first?.value {
                return value
            }
        }
        return nil
    }

    private static func preferredHours(afterAnyOf labels: [String], in lines: [String]) -> Double? {
        for index in lines.indices where labels.contains(where: { normalized(lines[index]).contains($0) }) {
            let end = min(index + 3, lines.count)
            let candidates = lines[index..<end]
                .flatMap(hoursWithContext)
                .sorted { lhs, rhs in
                    lhs.score == rhs.score ? lhs.value > rhs.value : lhs.score > rhs.score
                }
            if let value = candidates.first?.value {
                return value
            }
        }
        return nil
    }

    private static func currencyNumbersWithContext(in line: String) -> [(value: Double, score: Int)] {
        let pattern = #"(\d{1,3}(?:\s?\d{3})*(?:[,.]\d{1,2})?|\d{2,6}(?:[,.]\d{1,2})?)\s*(?:kc|czk)?"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return [] }
        let lower = normalized(line)
        return regex.matches(in: line, range: NSRange(line.startIndex..<line.endIndex, in: line)).compactMap { match in
            guard let range = Range(match.range(at: 1), in: line) else { return nil }
            let valueText = String(line[range]).replacingOccurrences(of: " ", with: "").replacingOccurrences(of: ",", with: ".")
            guard let value = Double(valueText), value >= 50 else { return nil }
            var score = 0
            if lower.contains("celkovy prijem") { score += 10 }
            if lower.contains("prijem") || lower.contains("vydelek") { score += 5 }
            if lower.contains("kc") || lower.contains("czk") { score += 2 }
            if lower.contains("zaklad") { score -= 2 }
            if lower.contains("spropitne") || lower.contains("hodinovy prumer") { score -= 4 }
            if lower.contains("km") { score -= 5 }
            if lower.contains("zakaz") || lower.contains("objedn") { score -= 3 }
            return (value, score)
        }
    }

    private static func hoursWithContext(in line: String) -> [(value: Double, score: Int)] {
        let patterns = [
            #"(\d{1,2})\s*h\s*(\d{1,2})\s*m"#,
            #"(\d{1,2})\s*[:.]\s*([0-5]\d)"#,
            #"(\d{1,2}(?:[,.]\d{1,2})?)\s*(?:h|hod|hodin)"#
        ]
        let lower = normalized(line)
        var results: [(Double, Int)] = []
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
            for match in regex.matches(in: line, range: NSRange(line.startIndex..<line.endIndex, in: line)) {
                var value: Double?
                if match.numberOfRanges > 2,
                   let firstRange = Range(match.range(at: 1), in: line),
                   let secondRange = Range(match.range(at: 2), in: line),
                   let first = Double(line[firstRange]),
                   let second = Double(line[secondRange]) {
                    value = first + second / 60
                } else if let range = Range(match.range(at: 1), in: line) {
                    value = Double(String(line[range]).replacingOccurrences(of: ",", with: "."))
                }
                guard let value, value > 0, value <= 24 else { continue }
                var score = 0
                if lower.contains("hod") || lower.contains("hour") { score += 3 }
                if lower.contains("odjezd") || lower.contains("online") { score += 5 }
                if lower.contains("kc") || lower.contains("czk") || lower.contains("km") { score -= 5 }
                if lower.contains(" - ") { score -= 3 }
                results.append((value, score))
            }
        }
        return results
    }

    private static func normalized(_ text: String) -> String {
        text
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "cs_CZ"))
            .lowercased()
    }
}
