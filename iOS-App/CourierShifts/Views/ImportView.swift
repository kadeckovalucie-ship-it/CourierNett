import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct ImportView: View {
    @EnvironmentObject private var store: ShiftStore
    @State private var showingPDFImporter = false
    @State private var selectedImage: PhotosPickerItem?
    @State private var status = ""
    @State private var manualKm = 0.0
    @State private var manualIncome = 0.0
    @State private var manualHours = 0.0
    @State private var manualDate = Date()
    @State private var isReadingImage = false
    @State private var selectedService: String?
    @State private var pendingPdfShifts: [CourierShift] = []
    @State private var triedSaving = false

    private let screenshotImporter = EarningsScreenshotImporter()
    private let pdfImporter = PDFShiftImporter()
    private let serviceOptions = ["Foodora", "Wolt", "Bolt"]

    var body: some View {
        NavigationStack {
            List {
                Section("Služba") {
                    ForEach(serviceOptions, id: \.self) { service in
                        ImportServiceRow(title: service, isSelected: selectedService == service) {
                            selectedService = service
                            triedSaving = false
                        }
                    }
                    if triedSaving && selectedService == nil {
                        ImportServiceWarningRow()
                    }
                }

                Section("Kniha jízd") {
                    Button {
                        showingPDFImporter = true
                    } label: {
                        Label("Vybrat PDF", systemImage: "doc")
                    }
                    DatePicker("Datum", selection: $manualDate, displayedComponents: [.date])
                    LabeledNumberField(title: "Kilometry", value: $manualKm, placeholder: "0 km")
                        .keyboardType(.decimalPad)
                }

                Section("Výdělek") {
                    PhotosPicker(selection: $selectedImage, matching: .images) {
                        Label("Vybrat screenshot", systemImage: "photo")
                    }
                    if isReadingImage { ProgressView("Ctu screenshot") }
                    LabeledNumberField(title: "Výdělek", value: $manualIncome, placeholder: "0 Kč")
                        .keyboardType(.decimalPad)
                    LabeledNumberField(title: "Hodiny", value: $manualHours, placeholder: "0 h")
                        .keyboardType(.decimalPad)
                }

                Section {
                    Button("Uložit") {
                        saveImport()
                    }
                }

                if !status.isEmpty {
                    Section { Text(status).foregroundStyle(.secondary) }
                }
            }
            .navigationTitle("Import")
            .fileImporter(isPresented: $showingPDFImporter, allowedContentTypes: [.pdf]) { result in
                handlePDF(result)
            }
            .onChange(of: selectedImage) {
                Task { await handleImage() }
            }
        }
    }

    private func handlePDF(_ result: Result<URL, Error>) {
        do {
            let url = try result.get()
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            let imported = try pdfImporter.importShifts(from: url)
            pendingPdfShifts = imported
            if let first = imported.first {
                manualDate = first.date
                manualKm = first.kilometers
            }
            status = "PDF načteno: \(imported.count) záznamů. Zkontroluj službu a klikni Uložit."
        } catch {
            status = error.localizedDescription
        }
    }

    private func handleImage() async {
        guard let selectedImage else { return }
        isReadingImage = true
        defer { isReadingImage = false }
        do {
            guard let data = try await selectedImage.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else { return }
            let result = try await screenshotImporter.importEarnings(from: image)
            manualDate = result.date
            manualIncome = result.income
            manualHours = result.hours ?? 0
            status = "Screenshot načten. Zkontroluj službu a klikni Uložit."
        } catch {
            status = error.localizedDescription
        }
    }

    private func saveImport() {
        guard let selectedService else {
            triedSaving = true
            status = "Nejdřív vyber službu."
            return
        }

        var saved = 0
        if pendingPdfShifts.isEmpty, manualKm > 0 {
            store.addOrMerge(date: manualDate, kilometers: manualKm, title: selectedService)
            saved += 1
        } else {
            for shift in pendingPdfShifts {
                store.addOrMerge(date: shift.date, kilometers: shift.kilometers, title: selectedService)
                saved += 1
            }
        }

        if manualIncome > 0 {
            store.addOrMerge(date: manualDate, income: manualIncome, hours: manualHours, title: selectedService)
            saved += 1
        }

        guard saved > 0 else {
            status = "Není co uložit."
            return
        }

        pendingPdfShifts = []
        status = "Import uložen."
    }
}

private struct ImportServiceRow: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .foregroundStyle(.primary)
                Spacer()
                Image(systemName: isSelected ? "checkmark.square.fill" : "square")
                    .font(.title3)
                    .foregroundStyle(isSelected ? .teal : .secondary)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct ImportServiceWarningRow: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text("Vyber službu")
                .foregroundStyle(.secondary)
            Spacer()
        }
        .font(.subheadline.weight(.semibold))
    }
}

private struct LabeledNumberField: View {
    let title: String
    @Binding var value: Double
    let placeholder: String

    var body: some View {
        HStack {
            Text(title)
                .foregroundStyle(.primary)
            Spacer(minLength: 12)
            TextField(placeholder, value: $value, format: .number.precision(.fractionLength(0...2)))
                .multilineTextAlignment(.trailing)
                .font(.body)
                .frame(maxWidth: 140)
        }
    }
}
