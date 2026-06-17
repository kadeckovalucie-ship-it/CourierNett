import SwiftUI

enum ShiftEditorMode {
    case create
    case edit(CourierShift)

    var title: String {
        switch self {
        case .create: "Nová směna"
        case .edit: "Upravit směnu"
        }
    }
}

struct ShiftEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let mode: ShiftEditorMode
    let onSave: (CourierShift) -> Void

    @State private var date: Date
    @State private var title: String?
    @State private var kilometers: Double
    @State private var hours: Double
    @State private var income: Double
    @State private var notes: String
    @State private var triedSaving = false
    private let id: UUID
    private let serviceOptions = ["Foodora", "Wolt", "Bolt"]

    init(mode: ShiftEditorMode, onSave: @escaping (CourierShift) -> Void) {
        self.mode = mode
        self.onSave = onSave
        switch mode {
        case .create:
            id = UUID()
            _date = State(initialValue: .now)
            _title = State(initialValue: nil)
            _kilometers = State(initialValue: 0)
            _hours = State(initialValue: 0)
            _income = State(initialValue: 0)
            _notes = State(initialValue: "")
        case .edit(let shift):
            id = shift.id
            _date = State(initialValue: shift.date)
            _title = State(initialValue: ["Foodora", "Wolt", "Bolt"].contains(shift.title) ? shift.title : nil)
            _kilometers = State(initialValue: shift.kilometers)
            _hours = State(initialValue: shift.hours)
            _income = State(initialValue: shift.income)
            _notes = State(initialValue: shift.notes)
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Směna") {
                    DatePicker("Datum", selection: $date, displayedComponents: [.date])
                }
                Section("Služba") {
                    ForEach(serviceOptions, id: \.self) { service in
                        ServiceOptionRow(title: service, isSelected: title == service) {
                            title = service
                            triedSaving = false
                        }
                    }
                    if triedSaving && title == nil {
                        ServiceWarningRow()
                    }
                }
                Section("Hodnoty") {
                    ShiftNumberField(title: "Kilometry", suffix: "km", value: $kilometers)
                    ShiftNumberField(title: "Hodiny", suffix: "h", value: $hours)
                    ShiftNumberField(title: "Výdělek", suffix: "Kč", value: $income)
                }
            }
            .navigationTitle(mode.title)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Zavřít") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Uložit") { save() }
                }
            }
        }
    }

    private func save() {
        guard let title else {
            triedSaving = true
            return
        }
        onSave(CourierShift(
            id: id,
            date: date,
            title: title,
            kilometers: max(0, kilometers),
            hours: max(0, hours),
            income: max(0, income),
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines)
        ))
        dismiss()
    }
}

private struct ServiceOptionRow: View {
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

private struct ServiceWarningRow: View {
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

private struct ShiftNumberField: View {
    let title: String
    let suffix: String
    @Binding var value: Double

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .foregroundStyle(.primary)
                Text(suffix)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            TextField("0", value: $value, format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 140)
        }
    }
}
