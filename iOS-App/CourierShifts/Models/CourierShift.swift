import Foundation

struct CourierShift: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var date: Date
    var title: String
    var kilometers: Double
    var hours: Double
    var income: Double
    var notes: String = ""
}

struct ExpenseSettings: Codable, Equatable {
    var consumptionLitersPer100km: Double = 10
    var fuelPricePerLiter: Double = 39
    var vehicleRent: Double = 0
    var fuelType: FuelType = .gasoline
    var productionYear: Double = 2020
    var amortizationMonthly: Double = 0
    var averageGasolinePrice: Double = 0
    var averageDieselPrice: Double = 0
    var averageLpgPrice: Double = 0
    var fuelPriceUpdatedAt: Date?

    var amortizationRatePerKm: Double {
        2.0 * ageCoefficient * fuelType.amortizationCoefficient
    }

    private var ageCoefficient: Double {
        switch Int(productionYear) {
        case 2020...:
            return 1.2
        case 2010...2019:
            return 1.0
        case 2000...2009:
            return 1.3
        default:
            return 1.6
        }
    }

    enum CodingKeys: String, CodingKey {
        case consumptionLitersPer100km
        case fuelPricePerLiter
        case vehicleRent
        case fuelType
        case productionYear
        case amortizationMonthly
        case averageGasolinePrice
        case averageDieselPrice
        case averageLpgPrice
        case fuelPriceUpdatedAt
    }

    init(
        consumptionLitersPer100km: Double = 10,
        fuelPricePerLiter: Double = 39,
        vehicleRent: Double = 0,
        fuelType: FuelType = .gasoline,
        productionYear: Double = 2020,
        amortizationMonthly: Double = 0,
        averageGasolinePrice: Double = 0,
        averageDieselPrice: Double = 0,
        averageLpgPrice: Double = 0,
        fuelPriceUpdatedAt: Date? = nil
    ) {
        self.consumptionLitersPer100km = consumptionLitersPer100km
        self.fuelPricePerLiter = fuelPricePerLiter
        self.vehicleRent = vehicleRent
        self.fuelType = fuelType
        self.productionYear = productionYear
        self.amortizationMonthly = amortizationMonthly
        self.averageGasolinePrice = averageGasolinePrice
        self.averageDieselPrice = averageDieselPrice
        self.averageLpgPrice = averageLpgPrice
        self.fuelPriceUpdatedAt = fuelPriceUpdatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        consumptionLitersPer100km = try container.decodeIfPresent(Double.self, forKey: .consumptionLitersPer100km) ?? 10
        fuelPricePerLiter = try container.decodeIfPresent(Double.self, forKey: .fuelPricePerLiter) ?? 39
        vehicleRent = try container.decodeIfPresent(Double.self, forKey: .vehicleRent) ?? 0
        fuelType = try container.decodeIfPresent(FuelType.self, forKey: .fuelType) ?? .gasoline
        productionYear = try container.decodeIfPresent(Double.self, forKey: .productionYear) ?? 2020
        amortizationMonthly = try container.decodeIfPresent(Double.self, forKey: .amortizationMonthly) ?? 0
        averageGasolinePrice = try container.decodeIfPresent(Double.self, forKey: .averageGasolinePrice) ?? 0
        averageDieselPrice = try container.decodeIfPresent(Double.self, forKey: .averageDieselPrice) ?? 0
        averageLpgPrice = try container.decodeIfPresent(Double.self, forKey: .averageLpgPrice) ?? 0
        fuelPriceUpdatedAt = try container.decodeIfPresent(Date.self, forKey: .fuelPriceUpdatedAt)
    }

    var currentAverageFuelPrice: Double {
        switch fuelType {
        case .gasoline: averageGasolinePrice
        case .diesel: averageDieselPrice
        case .lpg: averageLpgPrice
        }
    }
}

enum FuelType: String, Codable, CaseIterable, Identifiable {
    case gasoline
    case diesel
    case lpg

    var id: String { rawValue }

    var label: String {
        switch self {
        case .gasoline: "Benzín"
        case .diesel: "Diesel"
        case .lpg: "LPG"
        }
    }

    var amortizationCoefficient: Double {
        switch self {
        case .gasoline: 1.0
        case .diesel: 1.4
        case .lpg: 1.15
        }
    }
}

struct BusinessSettings: Codable, Equatable {
    var monthlyShiftCount: Double = 20
    var flatExpenseRate: Double = 0.8
    var isSideIncome: Bool = false

    enum CodingKeys: String, CodingKey {
        case monthlyShiftCount
        case flatExpenseRate
        case isSideIncome
    }

    init(monthlyShiftCount: Double = 20, flatExpenseRate: Double = 0.8, isSideIncome: Bool = false) {
        self.monthlyShiftCount = monthlyShiftCount
        self.flatExpenseRate = flatExpenseRate
        self.isSideIncome = isSideIncome
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        monthlyShiftCount = try container.decodeIfPresent(Double.self, forKey: .monthlyShiftCount) ?? 20
        flatExpenseRate = try container.decodeIfPresent(Double.self, forKey: .flatExpenseRate) ?? 0.8
        isSideIncome = try container.decodeIfPresent(Bool.self, forKey: .isSideIncome) ?? false
    }
}

struct AppPreferences: Codable, Equatable {
    var profileName: String = "Název profilu"
    var theme: AppTheme = .system
    var historySortAscending: Bool = false
}

enum AppTheme: String, Codable, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: "Podle telefonu"
        case .light: "Světlý"
        case .dark: "Tmavý"
        }
    }
}

struct AppData: Codable, Equatable {
    var shifts: [CourierShift]
    var expense: ExpenseSettings
    var business: BusinessSettings
    var preferences: AppPreferences
}

struct MonthTotals: Equatable {
    var income: Double
    var kilometers: Double
    var hours: Double
    var fuel: Double
    var taxes: Double
    var rent: Double
    var amortization: Double = 0

    var costs: Double { fuel + taxes + rent + amortization }
    var profit: Double { income - costs }
    var profitPerHour: Double? { hours > 0 ? profit / hours : nil }
}

struct ShiftCostBreakdown: Equatable {
    var fuelLiters: Double
    var fuelCost: Double
    var osvcShare: Double
    var vehicleRentShare: Double
    var amortizationShare: Double = 0
    var totalCost: Double
    var profit: Double
    var profitPerHour: Double?
    var hourlyRevenue: Double?
}

struct BusinessEstimate: Equatable {
    var monthlyRevenue: Double
    var annualRevenue: Double
    var monthlyIncomeTax: Double
    var monthlySocialInsurance: Double
    var monthlyHealthInsurance: Double
    var monthlyReserve: Double
}

extension CourierShift {
    static func demoShifts(for month: Date = .now) -> [CourierShift] {
        let calendar = Calendar.current
        let range = calendar.range(of: .day, in: .month, for: month) ?? 1..<29
        let daysInMonth = range.count
        let samples: [(Double, Double, Double)] = [
            (49.5, 4.4, 1760), (56.2, 4.8, 1680), (61.4, 5.2, 1880), (52.8, 4.5, 1760),
            (68.6, 5.7, 2110), (73.1, 6.1, 2290), (45.7, 3.9, 1080), (63.9, 5.4, 2050),
            (58.2, 4.9, 1960), (70.4, 5.8, 2380), (54.9, 4.6, 1780), (66.5, 5.5, 2220),
            (80.2, 6.4, 2470), (42.1, 3.8, 1390), (59.6, 5.0, 2130), (76.3, 6.0, 2590),
            (50.4, 4.2, 1730), (64.8, 5.1, 2360), (47.9, 4.0, 1560), (69.7, 5.3, 2520)
        ]

        return samples.enumerated().map { index, sample in
            let day = min(daysInMonth, 1 + Int((Double(index) * Double(daysInMonth - 1) / 19).rounded()))
            let date = calendar.date(from: DateComponents(
                year: calendar.component(.year, from: month),
                month: calendar.component(.month, from: month),
                day: day
            )) ?? month

            let services = ["Foodora", "Wolt", "Bolt"]

            return CourierShift(
                date: date,
                title: services[index % services.count],
                kilometers: sample.0,
                hours: sample.1,
                income: sample.2,
                notes: "Zkušební data pro první beta verzi."
            )
        }
    }
}
