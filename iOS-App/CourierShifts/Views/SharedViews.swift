import SwiftUI
import UIKit

struct PerformanceChart: View {
    let shifts: [CourierShift]
    @Binding var selectedShift: CourierShift?

    private var values: [(CourierShift, Double)] {
        shifts.map { ($0, $0.hours > 0 ? $0.income / $0.hours : 0) }
    }

    var body: some View {
        VStack(spacing: 8) {
            Text("Výkon")
                .font(.headline)
                .frame(maxWidth: .infinity)

            if values.count < 2 {
                ContentUnavailableView("Bez grafu", systemImage: "chart.xyaxis.line", description: Text("Graf se ukáže po uložení aspoň dvou směn."))
                    .frame(height: 160)
            } else {
                GeometryReader { proxy in
                    let width = proxy.size.width
                    let height = proxy.size.height
                    let maxValue = max(100, (values.map(\.1).max() ?? 0).rounded(.up))
                    let points = values.enumerated().map { index, item in
                        let x = CGFloat(index) / CGFloat(max(values.count - 1, 1)) * (width - 28) + 14
                        let y = height - 32 - CGFloat(item.1 / maxValue) * (height - 54)
                        return CGPoint(x: x, y: y)
                    }
                    let peakIndex = values.indices.max { values[$0].1 < values[$1].1 }
                    let lowIndex = values.indices.min { values[$0].1 < values[$1].1 }

                    ZStack {
                        ForEach(0..<Int(maxValue / 50) + 1, id: \.self) { line in
                            let value = Double(line * 50)
                            let y = height - 32 - CGFloat(value / maxValue) * (height - 54)
                            Path { path in
                                path.move(to: CGPoint(x: 14, y: y))
                                path.addLine(to: CGPoint(x: width - 14, y: y))
                            }
                            .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
                            if line.isMultiple(of: 2) {
                                Text("\(Int(value))")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .position(x: 8, y: y)
                            }
                        }

                        Path { path in
                            guard let first = points.first else { return }
                            path.move(to: first)
                            for point in points.dropFirst() { path.addLine(to: point) }
                        }
                        .stroke(.primary, lineWidth: 2)

                        ForEach(values.indices, id: \.self) { index in
                            Button {
                                selectedShift = values[index].0
                            } label: {
                                Circle()
                                    .fill(color(index: index, peakIndex: peakIndex, lowIndex: lowIndex))
                                    .frame(width: 10, height: 10)
                            }
                            .buttonStyle(.plain)
                            .position(points[index])

                            Text(weekday(values[index].0.date))
                                .font(.caption2)
                                .rotationEffect(.degrees(-35))
                                .position(x: points[index].x, y: height - 10)
                        }
                    }
                }
                .frame(height: 190)
            }
        }
        .padding(10)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private func color(index: Int, peakIndex: Int?, lowIndex: Int?) -> Color {
        if index == peakIndex { return .yellow }
        if index == lowIndex { return .red }
        return .primary
    }

    private func weekday(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "cs_CZ")
        formatter.dateFormat = "E"
        return formatter.string(from: date)
    }
}

struct ShiftDetailView: View {
    @EnvironmentObject private var store: ShiftStore
    @Environment(\.dismiss) private var dismiss
    @State var shift: CourierShift
    @State private var editing = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                let breakdown = store.breakdown(for: shift)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    DetailTile(title: "Výdělek", value: shift.income.money)
                    DetailTile(title: "Hodinový obrat", value: breakdown.hourlyRevenue?.money ?? "Bez hodin")
                    DetailTile(title: "Kilometry", value: shift.kilometers.kilometersText)
                    DetailTile(title: "Hodiny", value: shift.hours.hoursText)
                    DetailTile(title: "Náklady na km", value: (breakdown.fuelCost + breakdown.amortizationShare).money)
                    DetailTile(title: "Čistý zisk", value: breakdown.profit.money)
                }
                Spacer()
            }
            .padding()
            .navigationTitle(shift.date.formatted(date: .abbreviated, time: .omitted))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Zavřít") { dismiss() }
                }
                ToolbarItemGroup(placement: .primaryAction) {
                    Button {
                        editing = true
                    } label: {
                        Image(systemName: "pencil")
                    }
                    Button(role: .destructive) {
                        store.delete(shift)
                        dismiss()
                    } label: {
                        Image(systemName: "trash")
                    }
                }
            }
            .sheet(isPresented: $editing) {
                ShiftEditorView(mode: .edit(shift)) { updated in
                    shift = updated
                    store.update(updated)
                }
            }
        }
    }
}

struct DetailTile: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 5) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline.bold())
                .minimumScaleFactor(0.7)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, minHeight: 62)
        .padding(8)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 10))
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    var items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

enum PDFExporter {
    static func makePDF(month: Date, shifts: [CourierShift], totals: MonthTotals, profileName: String) -> URL {
        let html = html(month: month, shifts: shifts, totals: totals, profileName: profileName)
        let renderer = UIPrintPageRenderer()
        let formatter = UIMarkupTextPrintFormatter(markupText: html)
        renderer.addPrintFormatter(formatter, startingAtPageAt: 0)
        let page = CGRect(x: 0, y: 0, width: 595, height: 842)
        renderer.setValue(page, forKey: "paperRect")
        renderer.setValue(page.insetBy(dx: 36, dy: 36), forKey: "printableRect")

        let data = NSMutableData()
        UIGraphicsBeginPDFContextToData(data, page, nil)
        for index in 0..<renderer.numberOfPages {
            UIGraphicsBeginPDFPage()
            renderer.drawPage(at: index, in: UIGraphicsGetPDFContextBounds())
        }
        UIGraphicsEndPDFContext()

        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Prehled-\(month.monthKey).pdf")
        try? data.write(to: url)
        return url
    }

    private static func html(month: Date, shifts: [CourierShift], totals: MonthTotals, profileName: String) -> String {
        let rows = shifts.map { shift in
            let fuel = shift.kilometers * 10 / 100 * 39
            let profit = shift.income - fuel
            return "<tr><td>\(shift.date.formatted(date: .abbreviated, time: .omitted))</td><td>\(shift.title)</td><td>\(shift.income.money)</td><td>\(shift.kilometers.kilometersText)</td><td>\(shift.hours.hoursText)</td><td>\(profit.money)</td></tr>"
        }.joined()

        return """
        <html><head><meta charset="utf-8"><style>
        body{font-family:-apple-system;margin:0;color:#111;font-size:13px} h1{font-size:24px;margin:0 0 4px}.meta{color:#555;margin-bottom:18px}
        .summary{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;width:50%;min-width:360px;margin:0 auto 18px}.box{display:grid;align-content:center;justify-items:center;min-height:46px;border:1px solid #ddd;border-radius:7px;padding:6px 8px;text-align:center}.primary{grid-column:span 2}.wide{grid-column:span 3}.profit{background:#f0f8f4;border-color:#b8d8c9}.box span{color:#666;font-size:10px;text-transform:uppercase}.box strong{font-size:16px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left}th{text-transform:uppercase;font-size:11px;color:#555}td:nth-child(n+3),th:nth-child(n+3){text-align:right;white-space:nowrap}
        </style></head><body>
        <h1>\(month.pdfMonthTitle)</h1><p class="meta">\(profileName)</p>
        <section class="summary"><div class="box primary profit"><span>Zisk</span><strong>\(totals.profit.money)</strong></div><div class="box primary"><span>Hodiny</span><strong>\(totals.hours.hoursText)</strong></div><div class="box primary"><span>Kilometry</span><strong>\(totals.kilometers.kilometersText)</strong></div><div class="box wide"><span>Obrat</span><strong>\(totals.income.money)</strong></div><div class="box wide"><span>Náklady</span><strong>\(totals.costs.money)</strong></div></section>
        <table><thead><tr><th>Datum</th><th>Směna</th><th>Obrat</th><th>Kilometry</th><th>Hodiny</th><th>Čistý zisk</th></tr></thead><tbody>\(rows)</tbody></table>
        </body></html>
        """
    }
}
