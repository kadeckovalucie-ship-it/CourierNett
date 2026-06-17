import SwiftUI

private let projectInfoText = """
CourierNett

Osobní kalkulačka pro kurýry.

CourierNett vzniká jako praktický nástroj pro sledování kurýrních směn, nákladů a reálného čistého zisku. Cílem není vytvořit další složitý systém, ale odstranit co nejvíce administrativy z běžného provozu.

Cíl:
- sledovat příjem ze směn
- sledovat kilometry, palivo, amortizaci a další náklady
- počítat čistý zisk za měsíc i za hodinu
- připravit přehledné podklady pro vlastní kontrolu nebo účetní
- minimalizovat ruční přepisování dat

Princip:
- data zůstávají v zařízení uživatele
- aplikace nepoužívá vlastní backend
- aplikace neukládá soukromá data na externí server
- záloha dat je ruční a pod kontrolou uživatele
- cena paliva se může automaticky načíst z veřejného zdroje, ale uživatel ji může kdykoliv přepsat ručně

Stav projektu:
- aktivní vývoj
- používáno v reálném provozu
- webová verze je funkční bez serveru
- iOS verze je připravovaná jako nativní aplikace

Aktuální funkce:
- měsíční přehledy směn
- rozlišení služeb Wolt, Foodora a Bolt
- import knihy jízd z PDF
- import výdělku ze screenshotu
- výpočet paliva, amortizace a OSVČ nákladů
- výpočet čistého zisku
- graf výkonu podle směn
- export měsíčního přehledu do PDF
- lokální záloha a obnovení dat

Plánované funkce:
- přesnější automatizace vstupních dat
- pohodlnější práce s exporty pro účetní
- beta verze pro iPhone
- možná podpora Apple Watch pro měření trasy
- případné cloudové přihlášení až ve chvíli, kdy bude dávat smysl

Neplánované funkce:
- doporučování směn
- predikce výdělků
- heatmapy restaurací
- sledování uživatele mimo jeho vlastní data
- ukládání soukromých směn na cizí server bez jasného důvodu

Projekt nevznikl jako ukázkové portfolio. Vznikl z reálné potřeby: mít jednoduchý přehled o tom, kolik kurýrní práce skutečně vydělává po odečtení nákladů.
"""

struct SettingsView: View {
    @EnvironmentObject private var store: ShiftStore
    @State private var showingProjectInfo = false

    private var estimate: BusinessEstimate {
        store.businessEstimate()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    vehicleCosts
                    osvcInputs
                    osvcResults
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Náklady")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingProjectInfo = true
                    } label: {
                        Image(systemName: "info.circle")
                    }
                    .accessibilityLabel("O projektu")
                }
            }
            .sheet(isPresented: $showingProjectInfo) {
                ProjectInfoView()
            }
        }
    }

    private var vehicleCosts: some View {
        CostCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("Vozidlo")
                    .font(.headline)

                VStack(spacing: 10) {
                    EditableCostRow(
                        title: "Spotřeba",
                        suffix: "l / 100 km",
                        value: $store.expense.consumptionLitersPer100km
                    )
                    EditableCostRow(
                        title: "Cena paliva",
                        suffix: "Kč / litr",
                        value: $store.expense.fuelPricePerLiter
                    )
                    Text(fuelPriceInfo)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                    EditableCostRow(
                        title: "Pronájem vozidla",
                        suffix: "Kč / měsíc",
                        value: $store.expense.vehicleRent
                    )
                    PickerCostRow(title: "Typ paliva", selection: Binding(
                        get: { store.expense.fuelType },
                        set: { store.applyFuelType($0) }
                    ))
                    EditableCostRow(
                        title: "Rok výroby",
                        suffix: "rok",
                        value: $store.expense.productionYear
                    )
                    ReadOnlyCostRow(
                        title: "Amortizace",
                        value: "\(store.expense.amortizationRatePerKm.inputText) Kč / km"
                    )
                }
            }
        }
    }

    private var fuelPriceInfo: String {
        guard let updatedAt = store.expense.fuelPriceUpdatedAt else {
            return "Zdroj: mBenzin.cz, zatím nenačteno"
        }
        return "Zdroj: mBenzin.cz, načteno \(updatedAt.formatted(date: .abbreviated, time: .shortened))"
    }

    private var osvcInputs: some View {
        CostCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("OSVČ nastavení")
                    .font(.headline)

                Toggle("Vedlejší příjem", isOn: $store.business.isSideIncome)
                    .font(.body.weight(.medium))
                    .padding(.vertical, 4)

                VStack(spacing: 10) {
                    EditableCostRow(
                        title: "Směn za měsíc",
                        suffix: "směn",
                        value: $store.business.monthlyShiftCount
                    )

                    ReadOnlyCostRow(
                        title: "Výdělek za směnu",
                        value: store.averageIncomePerShift() > 0 ? store.averageIncomePerShift().money : "Bez dat"
                    )

                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Paušální výdaje")
                                .font(.subheadline.weight(.semibold))
                            Text("Zákonné procento")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Picker("Paušální výdaje", selection: $store.business.flatExpenseRate) {
                            Text("80 %").tag(0.8)
                            Text("60 %").tag(0.6)
                            Text("40 %").tag(0.4)
                            Text("30 %").tag(0.3)
                        }
                        .pickerStyle(.menu)
                        .tint(.teal)
                    }
                    .padding(12)
                    .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
    }

    private var osvcResults: some View {
        CostCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("OSVČ náklady")
                    .font(.headline)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    FixedTile(title: "Měsíční obrat", value: estimate.monthlyRevenue.money)
                    FixedTile(title: "Roční obrat", value: estimate.annualRevenue.money)
                    FixedTile(title: "Daň/měsíc", value: estimate.monthlyIncomeTax.money)
                    FixedTile(title: "Sociální/měsíc", value: estimate.monthlySocialInsurance.money)
                    FixedTile(title: "Zdravotní/měsíc", value: estimate.monthlyHealthInsurance.money)
                    FixedTile(title: "Rezerva/měsíc", value: estimate.monthlyReserve.money)
                }
            }
        }
    }
}

private struct ProjectInfoView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(projectInfoText)
                    .font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .navigationTitle("O projektu")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Zavřít") {
                        dismiss()
                    }
                }
            }
        }
    }
}

private struct CostCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct EditableCostRow: View {
    let title: String
    let suffix: String
    @Binding var value: Double

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(suffix)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            TextField(title, value: $value, format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(.title3)
                .frame(width: 120)
        }
        .padding(12)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct ReadOnlyCostRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 12) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Spacer()
            Text(value)
                .font(.title3.bold())
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .padding(12)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct PickerCostRow: View {
    let title: String
    @Binding var selection: FuelType

    var body: some View {
        HStack(spacing: 12) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Spacer()
            Picker(title, selection: $selection) {
                ForEach(FuelType.allCases) { type in
                    Text(type.label).tag(type)
                }
            }
            .pickerStyle(.menu)
            .tint(.teal)
        }
        .padding(12)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private struct FixedTile: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Text(value)
                .font(.headline.bold())
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, minHeight: 76)
        .padding(10)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
