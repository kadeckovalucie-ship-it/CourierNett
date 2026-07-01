const STORAGE_KEY = "couriernett-ios-web-v1";
const LEGACY_KEYS = ["naklady-smen-profiles-v1", "naklady-smen-web-v1"];
const SERVICES = ["Wolt", "Foodora", "Bolt"];
const DEMO_DATA_VERSION = 2;
const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const CLOUD_TABLE = "couriernett_profiles";
const BUSINESS_RULES_2026 = Object.freeze({
  averageWage: 48967,
  higherTaxThreshold: 1762812,
  basicTaxpayerCredit: 30840,
  socialRate: 0.292,
  socialAssessmentShare: 0.55,
  socialMainMonthlyMinimum: 5005,
  socialSideMonthlyMinimum: 1574,
  socialSideDecisionAmount: 117521,
  healthRate: 0.135,
  healthAssessmentShare: 0.5,
  healthMainMonthlyMinimum: 3306,
  flatExpenseRevenueCap: 2000000,
});
const MONTH_NAMES = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];

const defaults = {
  expense: {
    consumptionLitersPer100km: 10,
    fuelPricePerLiter: 39,
    vehicleRent: 0,
    fuelType: "gasoline",
    productionYear: 2020,
    averageGasolinePrice: 0,
    averageDieselPrice: 0,
    averageLpgPrice: 0,
    fuelPriceUpdatedAt: null,
  },
  business: {
    monthlyShiftCount: 20,
    flatExpenseRate: 0.8,
    isSideIncome: false,
  },
  preferences: {
    profileName: "Název profilu",
    theme: "system",
    historySortAscending: false,
  },
};

let state = loadState();
let selectedServices = new Set(SERVICES);
let selectedImportService = null;
let activeScreen = "dashboard";
let selectedShiftId = null;
const els = {};
const cloud = {
  client: null,
  user: null,
  status: "Cloud není připojen.",
  saveTimer: null,
  syncTimer: null,
  remoteUpdatedAt: null,
  isApplyingRemote: false,
};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  ensureCloudPasswordUi();
  cacheElements();
  runCalculationSelfCheck();
  removeLegacyTabIcons();
  bindEvents();
  setupClearOnFocusFields();
  syncForms();
  applyTheme();
  render();
  initCloud();
  registerServiceWorker();
});

function removeLegacyTabIcons() {
  document.querySelectorAll(".tabbar button span").forEach((icon) => icon.remove());
}

function setupClearOnFocusFields() {
  const selector = [
    "input[type='number']",
    "input[type='text']",
    "textarea",
  ].join(",");

  document.querySelectorAll(selector).forEach((field) => {
    field.addEventListener("focus", () => {
      if (field.dataset.clearOnFocusActive === "true" || field.value === "") return;
      field.dataset.clearOnFocusActive = "true";
      field.dataset.clearOnFocusValue = field.value;
      field.value = "";
    });

    field.addEventListener("input", () => {
      if (field.value === "") return;
      delete field.dataset.clearOnFocusActive;
      delete field.dataset.clearOnFocusValue;
    });

    field.addEventListener("blur", () => {
      if (field.dataset.clearOnFocusActive !== "true" || field.value !== "") return;
      field.value = field.dataset.clearOnFocusValue || "";
      delete field.dataset.clearOnFocusActive;
      delete field.dataset.clearOnFocusValue;
    });
  });
}

function cacheElements() {
  Object.assign(els, {
    screenTitle: document.querySelector("#screenTitle"),
    screenEyebrow: document.querySelector("#screenEyebrow"),
    settingsButton: document.querySelector("#settingsButton"),
    aboutButton: document.querySelector("#aboutButton"),
    themeToggle: document.querySelector("#themeToggle"),
    aboutDialog: document.querySelector("#aboutDialog"),
    closeAboutButton: document.querySelector("#closeAboutButton"),
    screens: [...document.querySelectorAll(".screen")],
    tabs: [...document.querySelectorAll(".tabbar button")],
    monthButton: document.querySelector("#monthButton"),
    monthInput: document.querySelector("#monthInput"),
    nextMonthButton: document.querySelector("#nextMonthButton"),
    exportButton: document.querySelector("#exportButton"),
    serviceFilter: document.querySelector("#serviceFilter"),
    metricGrid: document.querySelector("#metricGrid"),
    performanceChart: document.querySelector("#performanceChart"),
    dashboardShifts: document.querySelector("#dashboardShifts"),
    historySortToggle: document.querySelector("#historySortToggle"),
    historySortLabel: document.querySelector("#historySortLabel"),
    historyList: document.querySelector("#historyList"),
    importServices: document.querySelector("#importServices"),
    importDialogTitle: document.querySelector("#importDialogTitle"),
    importServiceStep: document.querySelector("#importServiceStep"),
    importFields: document.querySelector("#importFields"),
    changeImportServiceButton: document.querySelector("#changeImportServiceButton"),
    importDriveSection: document.querySelector("#importDriveSection"),
    importHoursRow: document.querySelector("#importHoursRow"),
    importDialog: document.querySelector("#importDialog"),
    closeImportButton: document.querySelector("#closeImportButton"),
    importWarning: document.querySelector("#importWarning"),
    pdfInput: document.querySelector("#pdfInput"),
    imageInput: document.querySelector("#imageInput"),
    importDate: document.querySelector("#importDate"),
    importKm: document.querySelector("#importKm"),
    importIncome: document.querySelector("#importIncome"),
    importHours: document.querySelector("#importHours"),
    saveImportButton: document.querySelector("#saveImportButton"),
    importStatus: document.querySelector("#importStatus"),
    expenseForm: document.querySelector("#expenseForm"),
    businessForm: document.querySelector("#businessForm"),
    fuelPriceInfo: document.querySelector("#fuelPriceInfo"),
    amortizationRate: document.querySelector("#amortizationRate"),
    averageIncome: document.querySelector("#averageIncome"),
    businessEstimate: document.querySelector("#businessEstimate"),
    calculationWarning: document.querySelector("#calculationWarning"),
    loginEmailInput: document.querySelector("#loginEmailInput"),
    loginPasswordInput: document.querySelector("#loginPasswordInput"),
    magicLinkButton: document.querySelector("#magicLinkButton"),
    signupButton: document.querySelector("#signupButton"),
    loginButton: document.querySelector("#loginButton"),
    resendConfirmationButton: document.querySelector("#resendConfirmationButton"),
    resetPasswordButton: document.querySelector("#resetPasswordButton"),
    newPasswordInput: document.querySelector("#newPasswordInput"),
    updatePasswordButton: document.querySelector("#updatePasswordButton"),
    passwordResetBox: document.querySelector("#passwordResetBox"),
    logoutButton: document.querySelector("#logoutButton"),
    syncNowButton: document.querySelector("#syncNowButton"),
    loadCloudButton: document.querySelector("#loadCloudButton"),
    cloudSignedOut: document.querySelector("#cloudSignedOut"),
    cloudSignedIn: document.querySelector("#cloudSignedIn"),
    cloudUser: document.querySelector("#cloudUser"),
    cloudLocalCount: document.querySelector("#cloudLocalCount"),
    cloudStatus: document.querySelector("#cloudStatus"),
    backupButton: document.querySelector("#backupButton"),
    backupInput: document.querySelector("#backupInput"),
    backupStatus: document.querySelector("#backupStatus"),
    demoButton: document.querySelector("#demoButton"),
    shiftDialog: document.querySelector("#shiftDialog"),
    shiftForm: document.querySelector("#shiftForm"),
    shiftDialogTitle: document.querySelector("#shiftDialogTitle"),
    shiftId: document.querySelector("#shiftId"),
    shiftDate: document.querySelector("#shiftDate"),
    shiftTitle: document.querySelector("#shiftTitle"),
    shiftKm: document.querySelector("#shiftKm"),
    shiftHours: document.querySelector("#shiftHours"),
    shiftIncome: document.querySelector("#shiftIncome"),
    shiftNotes: document.querySelector("#shiftNotes"),
    deleteShiftButton: document.querySelector("#deleteShiftButton"),
    detailDialog: document.querySelector("#shiftDetailDialog"),
    detailTitle: document.querySelector("#detailTitle"),
    detailGrid: document.querySelector("#detailGrid"),
    closeDetailButton: document.querySelector("#closeDetailButton"),
    editDetailButton: document.querySelector("#editDetailButton"),
    deleteDetailButton: document.querySelector("#deleteDetailButton"),
  });
}

function ensureCloudPasswordUi() {
  const signedOut = document.querySelector("#cloudSignedOut");
  const emailInput = document.querySelector("#loginEmailInput");
  const loginButton = document.querySelector("#loginButton");
  if (!signedOut || !emailInput || !loginButton) return;

  const hint = signedOut.querySelector(".hint");
  if (hint) {
    hint.textContent = "Vytvoř si účet e-mailem a heslem. Data pak budou uložená mimo konkrétní telefon nebo počítač.";
  }

  let passwordInput = document.querySelector("#loginPasswordInput");
  if (!passwordInput) {
    const passwordRow = document.createElement("label");
    passwordRow.className = "field-row";
    passwordRow.innerHTML = `
      <span>Heslo</span>
      <input id="loginPasswordInput" type="password" autocomplete="current-password" placeholder="aspoň 6 znaků">
    `;
    emailInput.closest("label")?.after(passwordRow);
    passwordInput = passwordRow.querySelector("#loginPasswordInput");
  }
  passwordInput.placeholder = "aspoň 6 znaků";

  let buttonList = loginButton.closest(".button-list");
  if (!buttonList) {
    buttonList = document.createElement("div");
    buttonList.className = "button-list";
    loginButton.replaceWith(buttonList);
    buttonList.append(loginButton);
  }

  loginButton.classList.remove("full", "primary-action");
  loginButton.textContent = "Přihlásit";

  if (!document.querySelector("#magicLinkButton")) {
    const magicLinkButton = document.createElement("button");
    magicLinkButton.id = "magicLinkButton";
    magicLinkButton.type = "button";
    magicLinkButton.textContent = "Poslat přihlašovací odkaz";
    buttonList.after(magicLinkButton);
  }

  if (!document.querySelector("#signupButton")) {
    const signupButton = document.createElement("button");
    signupButton.className = "primary-action";
    signupButton.id = "signupButton";
    signupButton.type = "button";
    signupButton.textContent = "Vytvořit účet";
    buttonList.prepend(signupButton);
  }

  if (!document.querySelector("#resetPasswordButton")) {
    const resetButton = document.createElement("button");
    resetButton.id = "resetPasswordButton";
    resetButton.type = "button";
    resetButton.textContent = "Zapomenuté heslo";
    buttonList.after(resetButton);
  }

  if (!document.querySelector("#resendConfirmationButton")) {
    const resendButton = document.createElement("button");
    resendButton.id = "resendConfirmationButton";
    resendButton.type = "button";
    resendButton.textContent = "Poslat potvrzení znovu";
    document.querySelector("#resetPasswordButton")?.after(resendButton);
  }

  if (!document.querySelector("#passwordResetBox")) {
    const resetBox = document.createElement("div");
    resetBox.className = "stack hidden";
    resetBox.id = "passwordResetBox";
    resetBox.innerHTML = `
      <label class="field-row">
        <span>Nové heslo</span>
        <input id="newPasswordInput" type="password" autocomplete="new-password" placeholder="aspoň 6 znaků">
      </label>
      <button class="full primary-action" id="updatePasswordButton" type="button">Uložit nové heslo</button>
    `;
    signedOut.after(resetBox);
  }
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchScreen(tab.dataset.screen));
  });
  els.settingsButton.addEventListener("click", () => switchScreen("preferences"));
  els.aboutButton.addEventListener("click", () => els.aboutDialog.showModal());
  els.closeAboutButton.addEventListener("click", () => els.aboutDialog.close());

  els.monthButton.addEventListener("click", () => {
    els.monthInput.showPicker?.();
    if (!els.monthInput.showPicker) els.monthInput.click();
  });
  els.monthInput.addEventListener("change", () => {
    state.selectedMonth = els.monthInput.value || currentMonth();
    saveAndRender();
  });
  els.nextMonthButton.addEventListener("click", () => {
    state.selectedMonth = nextMonth(state.selectedMonth);
    saveAndRender();
  });
  els.exportButton.addEventListener("click", exportPdf);

  els.historySortToggle.addEventListener("change", () => {
    state.preferences.historySortAscending = els.historySortToggle.checked;
    saveAndRender();
  });

  els.pdfInput.addEventListener("change", () => {
    els.importStatus.textContent = els.pdfInput.files?.[0]
      ? "PDF vybráno. Zkontroluj datum, kilometry a službu, potom klikni Uložit."
      : "";
  });
  els.imageInput.addEventListener("change", () => {
    els.importStatus.textContent = els.imageInput.files?.[0]
      ? (selectedImportService === "Bolt" ? "Screenshot vybrán, načítám datum, kilometry a výdělek…" : "Screenshot vybrán, načítám údaje…")
      : "";
  });
  els.pdfInput.addEventListener("change", importPdfFile);
  els.imageInput.addEventListener("change", importImageFile);
  els.closeImportButton.addEventListener("click", () => els.importDialog.close());
  els.changeImportServiceButton.addEventListener("click", showImportServiceStep);
  els.saveImportButton.addEventListener("click", saveImport);

  els.expenseForm.addEventListener("input", updateExpense);
  els.expenseForm.addEventListener("change", updateExpense);
  els.businessForm.addEventListener("input", updateBusiness);
  els.businessForm.addEventListener("change", updateBusiness);

  els.themeToggle.addEventListener("change", () => {
    state.preferences.theme = els.themeToggle.checked ? "dark" : "light";
    save();
    applyTheme();
  });
  els.signupButton?.addEventListener("click", signUpWithPassword);
  els.loginButton?.addEventListener("click", signInWithPassword);
  els.magicLinkButton?.addEventListener("click", signInWithEmail);
  els.resendConfirmationButton?.addEventListener("click", resendSignupConfirmation);
  els.resetPasswordButton?.addEventListener("click", sendPasswordReset);
  els.updatePasswordButton?.addEventListener("click", updatePasswordFromRecovery);
  els.logoutButton?.addEventListener("click", signOutCloud);
  els.syncNowButton?.addEventListener("click", () => saveCloudNow("Data uložená do cloudu."));
  els.loadCloudButton?.addEventListener("click", () => loadCloudData({ force: true }));
  els.backupButton.addEventListener("click", downloadBackup);
  els.backupInput.addEventListener("change", importBackup);
  els.demoButton.addEventListener("click", () => {
    createDemoData();
    els.backupStatus.textContent = "Zkušební data načtena.";
    saveAndRender();
  });

  els.shiftForm.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveShiftFromDialog();
  });
  els.deleteShiftButton.addEventListener("click", () => {
    deleteShift(els.shiftId.value);
    els.shiftDialog.close();
  });
  els.closeDetailButton.addEventListener("click", () => els.detailDialog.close());
  els.editDetailButton.addEventListener("click", () => {
    const shift = state.shifts.find((item) => item.id === selectedShiftId);
    els.detailDialog.close();
    if (shift) openShiftDialog(shift);
  });
  els.deleteDetailButton.addEventListener("click", () => {
    deleteShift(selectedShiftId);
    els.detailDialog.close();
  });
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      const normalized = normalizeState(stored);
      if (isOutdatedDemoState(normalized)) return demoState();
      return normalized.shifts.length ? normalized : demoState();
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  const migrated = migrateLegacyState();
  if (migrated) return migrated.shifts.length ? migrated : demoState();

  return demoState();
}

function migrateLegacyState() {
  for (const key of LEGACY_KEYS) {
    try {
      const legacy = JSON.parse(localStorage.getItem(key));
      const profile = legacy?.profiles?.find((item) => item.id === legacy.activeProfileId) || legacy?.profiles?.[0];
      if (!profile) continue;
      const shifts = Object.values(profile.overviews || {})
        .flatMap((overview) => overview.shifts || [])
        .map((shift) => ({
          id: shift.id || createId(),
          date: shift.date || new Date().toISOString().slice(0, 10),
          title: normalizeService(shift.title),
          kilometers: number(shift.kilometers),
          hours: number(shift.hours),
          income: number(shift.income),
          notes: shift.notes || "",
        }));
      return normalizeState({
        shifts,
        selectedMonth: profile.activeMonth || currentMonth(),
        expense: profile.expense || defaults.expense,
        business: profile.business || defaults.business,
        preferences: {
          profileName: profile.profile?.profileName || profile.profileName || defaults.preferences.profileName,
          theme: profile.appearance?.theme || profile.preferences?.theme || "system",
          historySortAscending: profile.historySortAscending || false,
        },
      });
    } catch {
      continue;
    }
  }
  return null;
}

function normalizeState(data, fallback = {}) {
  return {
    shifts: Array.isArray(data.shifts) ? data.shifts.map(normalizeShift).sort(sortByDate) : [],
    selectedMonth: data.selectedMonth || currentMonth(),
    expense: normalizeExpense(data.expense, fallback.expense),
    business: { ...defaults.business, ...(data.business || {}) },
    preferences: { ...defaults.preferences, ...(data.preferences || {}) },
    demoDataVersion: Number(data.demoDataVersion) || 0,
    updatedAt: data.updatedAt || null,
  };
}

function normalizeExpense(expense = {}, fallback = {}) {
  const fallbackExpense = { ...defaults.expense, ...(fallback || {}) };
  const merged = { ...fallbackExpense, ...(expense || {}) };
  const fuelType = ["gasoline", "diesel", "lpg"].includes(merged.fuelType)
    ? merged.fuelType
    : fallbackExpense.fuelType;
  return {
    consumptionLitersPer100km: number(merged.consumptionLitersPer100km),
    fuelPricePerLiter: number(merged.fuelPricePerLiter),
    vehicleRent: number(merged.vehicleRent),
    fuelType: ["gasoline", "diesel", "lpg"].includes(fuelType) ? fuelType : defaults.expense.fuelType,
    productionYear: number(merged.productionYear) || number(fallbackExpense.productionYear) || defaults.expense.productionYear,
    averageGasolinePrice: number(merged.averageGasolinePrice),
    averageDieselPrice: number(merged.averageDieselPrice),
    averageLpgPrice: number(merged.averageLpgPrice),
    fuelPriceUpdatedAt: merged.fuelPriceUpdatedAt || null,
  };
}

function isOutdatedDemoState(data) {
  return data.shifts.length > 0
    && data.demoDataVersion < DEMO_DATA_VERSION
    && data.shifts.every((shift) => shift.notes?.startsWith("Zkušební přehled:"));
}

function normalizeShift(shift) {
  return {
    id: shift.id || createId(),
    date: toDateInput(shift.date || new Date()),
    title: normalizeService(shift.title),
    kilometers: number(shift.kilometers),
    hours: number(shift.hours),
    income: number(shift.income),
    notes: shift.notes || "",
  };
}

function saveAndRender() {
  save();
  render();
}

function save() {
  state.updatedAt = new Date().toISOString();
  state = normalizeState(state, state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueCloudSave();
}

function render() {
  els.screenTitle.textContent = userLabel();
  els.screenEyebrow.textContent = screenLabel(activeScreen);
  els.monthInput.value = state.selectedMonth;
  els.monthButton.textContent = shortMonthLabel(state.selectedMonth);

  renderServiceFilter();
  renderMetrics();
  renderChart();
  renderDashboardShifts();
  renderHistory();
  renderImportServices();
  renderCosts();
  renderCloud();
  syncForms();
}

function switchScreen(screen) {
  activeScreen = screen;
  els.screens.forEach((item) => item.classList.toggle("active", item.id === `screen-${screen}`));
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.screen === screen));
  els.settingsButton.classList.toggle("active", screen === "preferences");
  render();
}

function screenLabel(screen) {
  return {
    dashboard: "Přehled",
    history: "Historie",
    costs: "Náklady",
    preferences: "Nastavení",
  }[screen] || "Přehled";
}

function syncForms() {
  if (!els.expenseForm) return;
  const expense = state.expense;
  els.expenseForm.consumptionLitersPer100km.value = expense.consumptionLitersPer100km;
  els.expenseForm.fuelPricePerLiter.value = expense.fuelPricePerLiter;
  els.expenseForm.vehicleRent.value = expense.vehicleRent;
  els.expenseForm.fuelType.value = expense.fuelType;
  els.expenseForm.productionYear.value = expense.productionYear;
  els.businessForm.monthlyShiftCount.value = state.business.monthlyShiftCount;
  els.businessForm.flatExpenseRate.value = state.business.flatExpenseRate;
  els.businessForm.isSideIncome.checked = state.business.isSideIncome;
  els.historySortToggle.checked = state.preferences.historySortAscending;
  els.themeToggle.checked = resolvedTheme() === "dark";
  els.importDate.value ||= toDateInput(new Date());
}

function renderServiceFilter() {
  els.serviceFilter.innerHTML = [
    chipMarkup("Vše", selectedServices.size === SERVICES.length, "all"),
    ...SERVICES.map((service) => chipMarkup(service, selectedServices.has(service), service)),
  ].join("");
  els.serviceFilter.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => toggleService(button.dataset.service));
  });
}

function chipMarkup(label, active, service) {
  return `<button class="chip ${active ? "active" : ""}" data-service="${escapeHtml(service)}" type="button">${escapeHtml(label)}</button>`;
}

function toggleService(service) {
  if (service === "all") {
    selectedServices = new Set(SERVICES);
  } else if (selectedServices.size === SERVICES.length) {
    selectedServices = new Set([service]);
  } else if (selectedServices.has(service) && selectedServices.size > 1) {
    selectedServices.delete(service);
  } else {
    selectedServices.add(service);
  }
  render();
}

function renderMetrics() {
  const shifts = displayedShifts();
  const totals = totalsFor(shifts);
  const profitPerKm = totals.kilometers > 0 ? totals.profit / totals.kilometers : null;
  const avgFuelPerShift = averageFuelCostPerShift(shifts);
  const items = [
    ["Příjem", money(totals.income)],
    ["Náklady", money(totals.costs)],
    ["Čistý zisk", money(totals.profit), totals.profit >= 0 ? "good" : "bad"],
    ["Kč/h", totals.profitPerHour == null ? "Bez hodin" : money(totals.profitPerHour), totals.profit >= 0 ? "good" : "bad"],
    ["Kč/km", profitPerKm == null ? "Bez km" : money(profitPerKm), totals.profit >= 0 ? "good" : "bad"],
    ["Palivo/sm\u011bna", avgFuelPerShift == null ? "Bez km" : money(avgFuelPerShift)],
  ];
  els.metricGrid.innerHTML = items.map(metricMarkup).join("");
}

function metricMarkup([title, value, tone = ""]) {
  return `<article class="metric ${tone}"><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong></article>`;
}

function renderChart() {
  const shifts = displayedShifts();
  if (shifts.length < 2) {
    els.performanceChart.innerHTML = `<div class="empty">Graf se ukáže po uložení aspoň dvou směn.</div>`;
    return;
  }

  const width = 720;
  const height = 210;
  const values = shifts.map((shift) => shift.hours > 0 ? shift.income / shift.hours : 0);
  const maxValue = Math.max(100, Math.ceil(Math.max(...values) / 50) * 50);
  const points = shifts.map((shift, index) => {
    const x = 24 + (index / Math.max(shifts.length - 1, 1)) * (width - 48);
    const y = height - 34 - (values[index] / maxValue) * (height - 68);
    return { x, y, shift, value: values[index] };
  });
  const peak = maxBy(points, "value")?.shift.id;
  const low = minBy(points, "value")?.shift.id;
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const grid = Array.from({ length: Math.floor(maxValue / 50) + 1 }, (_, index) => {
    const value = index * 50;
    const y = height - 34 - (value / maxValue) * (height - 68);
    return `<line x1="24" y1="${y}" x2="${width - 24}" y2="${y}" stroke="currentColor" opacity="0.12"/><text x="4" y="${y + 4}" font-size="10" fill="currentColor" opacity="0.55">${value}</text>`;
  }).join("");
  const dots = points.map((point) => {
    const color = point.shift.id === peak ? "var(--warn)" : point.shift.id === low ? "var(--bad)" : "var(--text)";
    return `<circle class="chart-dot" data-id="${point.shift.id}" cx="${point.x}" cy="${point.y}" r="7" style="fill:${color}"/><text x="${point.x - 9}" y="${height - 8}" font-size="11" fill="currentColor" opacity="0.72" transform="rotate(-35 ${point.x - 9} ${height - 8})">${weekday(point.shift.date)}</text>`;
  }).join("");

  els.performanceChart.innerHTML = `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Graf výkonu">
        ${grid}
        <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="3"/>
        ${dots}
      </svg>
    </div>
  `;
  els.performanceChart.querySelectorAll(".chart-dot").forEach((dot) => {
    dot.addEventListener("click", () => openShiftDetail(dot.dataset.id));
  });
}

function renderDashboardShifts() {
  const shifts = displayedShifts();
  const peak = maxBy(shifts, "hourlyRevenue")?.id;
  const low = minBy(shifts, "hourlyRevenue")?.id;
  els.dashboardShifts.innerHTML = [
    `<button class="add-tile" type="button" aria-label="Přidat směnu">+</button>`,
    ...shifts.map((shift) => {
      const tone = shift.id === peak ? "peak" : shift.id === low ? "low" : "";
      return `<button class="shift-tile ${tone}" data-id="${shift.id}" type="button">${dayLabel(shift.date)}</button>`;
    }),
  ].join("");
  els.dashboardShifts.querySelector(".add-tile").addEventListener("click", openImportDialog);
  els.dashboardShifts.querySelectorAll(".shift-tile").forEach((button) => {
    button.addEventListener("click", () => openShiftDetail(button.dataset.id));
  });
}

function renderHistory() {
  els.historySortLabel.textContent = state.preferences.historySortAscending ? "Od nejstaršího" : "Od nejnovějšího";
  const months = historyMonths();
  if (!months.length) {
    els.historyList.innerHTML = `<p class="empty">Zatím tu není žádný uložený přehled.</p>`;
    return;
  }
  els.historyList.innerHTML = months.map((month) => {
    const totals = totalsFor(shiftsInMonth(month));
    return `
      <article class="history-card">
        <button class="history-open" data-month="${month}" type="button">
          <header><span>${shortMonthLabel(month)}</span><strong style="color:${totals.profit >= 0 ? "var(--good)" : "var(--bad)"}">${money(totals.profit)}</strong></header>
          <div class="history-values">
            <div><span>Km</span><strong>${km(totals.kilometers)}</strong></div>
            <div><span>Náklady/km</span><strong>${money(totals.fuel + totals.amortization)}</strong></div>
            <div><span>Hodiny</span><strong>${hours(totals.hours)}</strong></div>
            <div><span>Obrat</span><strong>${money(totals.income)}</strong></div>
          </div>
        </button>
        <button class="history-delete" data-month="${month}" type="button" aria-label="Smazat ${shortMonthLabel(month)}">Smazat</button>
      </article>
    `;
  }).join("");
  els.historyList.querySelectorAll(".history-open").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedMonth = card.dataset.month;
      switchScreen("dashboard");
      saveAndRender();
    });
  });
  els.historyList.querySelectorAll(".history-delete").forEach((button) => {
    button.addEventListener("click", () => deleteMonth(button.dataset.month));
  });
}

function renderImportServices() {
  els.importServices.innerHTML = SERVICES.map((service) => `
    <button class="service-row ${selectedImportService === service ? "active" : ""}" data-service="${service}" type="button">
      <span>${service}</span><strong>${selectedImportService === service ? "✓" : "□"}</strong>
    </button>
  `).join("");
  els.importServices.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedImportService = button.dataset.service;
      els.importWarning.classList.add("hidden");
      renderImportServices();
      showImportForm(button.dataset.service);
    });
  });
}

function renderCosts() {
  els.amortizationRate.textContent = `${numberText(amortizationRatePerKm())} Kč / km`;
  els.averageIncome.textContent = averageIncomePerShift() > 0 ? money(averageIncomePerShift()) : "Bez dat";
  const estimate = businessEstimate();
  els.businessEstimate.innerHTML = [
    ["Měsíční obrat", money(estimate.monthlyRevenue)],
    ["Roční obrat", money(estimate.annualRevenue)],
    ["Daň/měsíc", money(estimate.monthlyIncomeTax)],
    ["Sociální/měsíc", money(estimate.monthlySocialInsurance)],
    ["Zdravotní/měsíc", money(estimate.monthlyHealthInsurance)],
    ["Rezerva/měsíc", money(estimate.monthlyReserve)],
  ].map(metricMarkup).join("");
  els.fuelPriceInfo.textContent = state.expense.fuelPriceUpdatedAt
    ? `Zdroj: mBenzin.cz, načteno ${dateTime(state.expense.fuelPriceUpdatedAt)}`
    : "Zdroj: mBenzin.cz, zatím nenačteno";
}

function updateExpense() {
  const form = els.expenseForm;
  state.expense = {
    ...state.expense,
    consumptionLitersPer100km: number(form.consumptionLitersPer100km.value),
    fuelPricePerLiter: number(form.fuelPricePerLiter.value),
    vehicleRent: number(form.vehicleRent.value),
    fuelType: form.fuelType.value,
    productionYear: number(form.productionYear.value),
  };
  saveAndRender();
}

function updateBusiness() {
  const form = els.businessForm;
  state.business = {
    monthlyShiftCount: number(form.monthlyShiftCount.value),
    flatExpenseRate: number(form.flatExpenseRate.value) || 0.8,
    isSideIncome: form.isSideIncome.checked,
  };
  saveAndRender();
}

async function initCloud() {
  const config = globalThis.COURIERNETT_SUPABASE;
  if (!config?.url || !config?.publishableKey) {
    setCloudStatus("Cloud není nastaven.");
    return;
  }

  try {
    const { createClient } = await import(SUPABASE_JS_URL);
    cloud.client = createClient(config.url, config.publishableKey);
    cloud.client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") showPasswordResetBox();
      handleCloudSession(session, { loadRemote: true });
    });
    const { data, error } = await cloud.client.auth.getSession();
    if (error) throw error;
    await handleCloudSession(data.session, { loadRemote: true });
  } catch (error) {
    setCloudStatus(`Cloud se nepodařilo připojit: ${friendlyCloudError(error)}`);
  }
}

async function handleCloudSession(session, options = {}) {
  cloud.user = session?.user || null;
  if (!cloud.user) {
    setCloudStatus("Nejsi přihlášená. Data jsou zatím jen v tomto zařízení.");
    stopCloudPolling();
    renderCloud();
    return;
  }

  setCloudStatus(`Přihlášeno jako ${cloud.user.email || "účet"}.`);
  renderCloud();
  if (options.loadRemote) await loadCloudData({ initial: true });
  startCloudPolling();
}

async function signInWithEmail() {
  const email = els.loginEmailInput?.value?.trim();
  if (!email) {
    setCloudStatus("Zadej e-mail.");
    return;
  }
  if (!cloud.client) {
    setCloudStatus("Cloud ještě není připravený.");
    return;
  }

  try {
    setCloudStatus("Posílám přihlašovací odkaz...");
    const { error } = await cloud.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}${location.pathname}` },
    });
    if (error) throw error;
    setCloudStatus("Hotovo. Otevři odkaz v e-mailu na tomto zařízení.");
  } catch (error) {
    setCloudStatus(`Přihlášení se nepodařilo: ${friendlyCloudError(error)}`);
  }
}

async function signUpWithPassword() {
  const credentials = readLoginCredentials();
  if (!credentials) return;

  try {
    setCloudStatus("Vytvářím účet...");
    const { data, error } = await cloud.client.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: { emailRedirectTo: `${location.origin}${location.pathname}` },
    });
    if (error) throw error;
    if (data.session) {
      await handleCloudSession(data.session, { loadRemote: true });
      setCloudStatus("Účet vytvořen a přihlášen.");
    } else {
      setCloudStatus("Účet vytvořen. Potvrď e-mail a potom se přihlas.");
    }
  } catch (error) {
    setCloudStatus(`Účet se nepodařilo vytvořit: ${friendlyCloudError(error)}`);
  }
}

async function signInWithPassword() {
  const credentials = readLoginCredentials();
  if (!credentials) return;

  try {
    setCloudStatus("Přihlašuji...");
    const { data, error } = await cloud.client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error) throw error;
    await handleCloudSession(data.session, { loadRemote: true });
  } catch (error) {
    setCloudStatus(`Přihlášení se nepodařilo: ${friendlyCloudError(error)}`);
  }
}

function readLoginCredentials() {
  const email = els.loginEmailInput?.value?.trim();
  const password = els.loginPasswordInput?.value || "";
  if (!email) {
    setCloudStatus("Zadej e-mail.");
    return null;
  }
  if (password.length < 6) {
    setCloudStatus("Heslo musí mít aspoň 6 znaků.");
    return null;
  }
  if (!cloud.client) {
    setCloudStatus("Cloud ještě není připravený.");
    return null;
  }
  return { email, password };
}

async function resendSignupConfirmation() {
  const email = els.loginEmailInput?.value?.trim();
  if (!email) {
    setCloudStatus("Zadej e-mail, kam mám poslat potvrzení účtu.");
    return;
  }
  if (!cloud.client) {
    setCloudStatus("Cloud ještě není připravený.");
    return;
  }

  try {
    setCloudStatus("Posílám potvrzovací e-mail...");
    const { error } = await cloud.client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${location.origin}${location.pathname}` },
    });
    if (error) throw error;
    setCloudStatus("Potvrzovací e-mail odeslán. Zkontroluj i spam nebo hromadnou poštu.");
  } catch (error) {
    setCloudStatus(`Potvrzení se nepodařilo poslat: ${friendlyCloudError(error)}`);
  }
}

async function sendPasswordReset() {
  const email = els.loginEmailInput?.value?.trim();
  if (!email) {
    setCloudStatus("Zadej e-mail, kam mám poslat reset hesla.");
    return;
  }
  if (!cloud.client) {
    setCloudStatus("Cloud ještě není připravený.");
    return;
  }

  try {
    setCloudStatus("Posílám odkaz pro reset hesla...");
    const { error } = await cloud.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}${location.pathname}`,
    });
    if (error) throw error;
    setCloudStatus("Hotovo. Otevři e-mail a klikni na odkaz pro nastavení nového hesla.");
  } catch (error) {
    setCloudStatus(`Reset hesla se nepodařilo poslat: ${friendlyCloudError(error)}`);
  }
}

function showPasswordResetBox() {
  els.cloudSignedOut?.classList.add("hidden");
  els.passwordResetBox?.classList.remove("hidden");
  setCloudStatus("Zadej nové heslo.");
}

async function updatePasswordFromRecovery() {
  const password = els.newPasswordInput?.value || "";
  if (password.length < 6) {
    setCloudStatus("Nové heslo musí mít aspoň 6 znaků.");
    return;
  }
  if (!cloud.client) {
    setCloudStatus("Cloud ještě není připravený.");
    return;
  }

  try {
    setCloudStatus("Ukládám nové heslo...");
    const { error } = await cloud.client.auth.updateUser({ password });
    if (error) throw error;
    els.newPasswordInput.value = "";
    els.passwordResetBox?.classList.add("hidden");
    setCloudStatus("Heslo je změněné. Jsi přihlášená.");
    renderCloud();
  } catch (error) {
    setCloudStatus(`Heslo se nepodařilo změnit: ${friendlyCloudError(error)}`);
  }
}

async function signOutCloud() {
  if (!cloud.client) return;
  await cloud.client.auth.signOut();
  cloud.user = null;
  setCloudStatus("Odhlášeno. Data zůstávají uložená lokálně.");
  renderCloud();
}

async function loadCloudData(options = {}) {
  if (!cloud.client || !cloud.user) return;
  try {
    setCloudStatus("Načítám data z cloudu...");
    const { data, error } = await cloud.client
      .from(CLOUD_TABLE)
      .select("data, updated_at")
      .eq("user_id", cloud.user.id)
      .maybeSingle();
    if (error) throw error;

    if (!data?.data) {
      await saveCloudNow("Cloud byl prázdný, uložila jsem sem aktuální data.");
      return;
    }

    state = normalizeState(data.data, state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    applyTheme();
    render();
    setCloudStatus(options.force ? "Data načtená z cloudu." : "Data synchronizovaná z cloudu.");
  } catch (error) {
    cloud.isApplyingRemote = false;
    setCloudStatus(`Cloud se nepodařilo načíst: ${friendlyCloudError(error)}`);
  }
}

function queueCloudSave() {
  if (!cloud.client || !cloud.user || cloud.isApplyingRemote) return;
  clearTimeout(cloud.saveTimer);
  cloud.saveTimer = setTimeout(() => saveCloudNow("Data uložená do cloudu."), 900);
}

async function saveCloudNow(successMessage = "Data uložená do cloudu.") {
  if (!cloud.client || !cloud.user) {
    setCloudStatus("Nejdřív se přihlas.");
    return;
  }
  try {
    const payload = normalizeState({ ...state, updatedAt: new Date().toISOString() });
    setCloudStatus(`Odesilam z tohoto zarizeni ${payload.shifts.length} smen: ${shiftSummary(payload.shifts)}.`);
    const { error } = await cloud.client
      .from(CLOUD_TABLE)
      .upsert({
        user_id: cloud.user.id,
        data: payload,
        updated_at: payload.updatedAt,
      }, { onConflict: "user_id" });
    if (error) throw error;
    state = normalizeState(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const savedData = await fetchCloudProfile();
    const savedState = savedData?.data
      ? normalizeState({ ...savedData.data, updatedAt: savedData.data.updatedAt || savedData.updated_at }, state)
      : state;
    setCloudStatus(`${successMessage} Server potvrdil ${savedState.shifts.length} smen.`);
  } catch (error) {
    setCloudStatus(`Cloud se nepodařilo uložit: ${friendlyCloudError(error)}`);
  }
}

async function fetchCloudProfile() {
  const { data, error } = await cloud.client
    .from(CLOUD_TABLE)
    .select("data, updated_at")
    .eq("user_id", cloud.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function applyCloudState(remoteState, statusMessage) {
  cloud.isApplyingRemote = true;
  state = normalizeState(remoteState, state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  cloud.isApplyingRemote = false;
  applyTheme();
  render();
  setCloudStatus(statusMessage);
}

function mergeProfileStates(localState, remoteState, preferRemote = true) {
  const local = normalizeState(localState);
  const remote = normalizeState(remoteState, local);
  const primary = preferRemote ? remote : local;
  const secondary = preferRemote ? local : remote;
  return normalizeState({
    ...secondary,
    ...primary,
    expense: { ...secondary.expense, ...primary.expense },
    business: { ...secondary.business, ...primary.business },
    preferences: { ...secondary.preferences, ...primary.preferences },
    shifts: mergeShifts(secondary.shifts, primary.shifts),
    updatedAt: new Date().toISOString(),
  });
}

function mergeShifts(secondaryShifts, primaryShifts) {
  const merged = [];
  const positions = new Map();
  [...secondaryShifts, ...primaryShifts].forEach((shift) => {
    const normalized = normalizeShift(shift);
    const keys = shiftMergeKeys(normalized);
    const index = keys.map((key) => positions.get(key)).find((value) => value != null);
    if (index == null) {
      positions.set(keys[0], merged.length);
      positions.set(keys[1], merged.length);
      merged.push(normalized);
      return;
    }
    merged[index] = mergeShift(merged[index], normalized);
    shiftMergeKeys(merged[index]).forEach((key) => positions.set(key, index));
  });
  return merged.sort(sortByDate);
}

function shiftMergeKeys(shift) {
  return [
    `id:${shift.id}`,
    `day-service:${shift.date}:${shift.title}`,
  ];
}

function mergeShift(base, incoming) {
  return normalizeShift({
    ...base,
    ...incoming,
    kilometers: incoming.kilometers || base.kilometers,
    hours: incoming.hours || base.hours,
    income: incoming.income || base.income,
    notes: incoming.notes || base.notes,
  });
}

function timestampValue(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function startCloudPolling() {
  stopCloudPolling();
  cloud.syncTimer = setInterval(syncCloudIfNewer, 15000);
}

function stopCloudPolling() {
  if (!cloud.syncTimer) return;
  clearInterval(cloud.syncTimer);
  cloud.syncTimer = null;
}

async function syncCloudIfNewer() {
  if (!cloud.client || !cloud.user || cloud.isApplyingRemote) return;
  try {
    const data = await fetchCloudProfile();
    if (!data?.data) return;
    const remoteState = normalizeState({ ...data.data, updatedAt: data.data.updatedAt || data.updated_at }, state);
    const remoteTime = timestampValue(data.updated_at || remoteState.updatedAt);
    const localTime = timestampValue(state.updatedAt);
    cloud.remoteUpdatedAt = data.updated_at || remoteState.updatedAt;
    if (remoteTime > localTime) {
      const mergedState = mergeProfileStates(state, remoteState, true);
      applyCloudState(mergedState, "Nactena novejsi data z cloudu.");
      if (state.shifts.length > remoteState.shifts.length) {
        await saveCloudNow("Data sloucena s cloudem.");
      }
      return;
    }
  } catch {
    // Silent polling keeps the UI calm; manual cloud buttons still report errors.
  }
}

async function loadCloudData(options = {}) {
  if (!cloud.client || !cloud.user) return;
  try {
    setCloudStatus("Načítám data z cloudu...");
    const data = await fetchCloudProfile();

    if (!data?.data) {
      await saveCloudNow("Cloud byl prázdný, uložila jsem sem aktuální data.");
      return;
    }

    const remoteState = normalizeState({ ...data.data, updatedAt: data.data.updatedAt || data.updated_at }, state);
    const remoteTime = timestampValue(data.updated_at || remoteState.updatedAt);
    const localTime = timestampValue(state.updatedAt);
    cloud.remoteUpdatedAt = data.updated_at || remoteState.updatedAt;

    const mergedState = mergeProfileStates(state, remoteState, options.force || remoteTime >= localTime);
    applyCloudState(mergedState, `Slouceno: zarizeni ${state.shifts.length}, cloud ${remoteState.shifts.length}, vysledek ${mergedState.shifts.length}.`);
    await saveCloudNow("Data sloucena s cloudem.");
    return;

    await saveCloudNow("Tahle verze byla novější, uložila jsem ji do cloudu.");
  } catch (error) {
    cloud.isApplyingRemote = false;
    setCloudStatus(`Cloud se nepodařilo načíst: ${friendlyCloudError(error)}`);
  }
}

async function saveCloudNow(successMessage = "Data uložená do cloudu.") {
  if (!cloud.client || !cloud.user) {
    setCloudStatus("Nejdřív se přihlas.");
    return;
  }
  try {
    const payload = normalizeState({ ...state, updatedAt: new Date().toISOString() });
    setCloudStatus(`Odesilam z tohoto zarizeni ${payload.shifts.length} smen: ${shiftSummary(payload.shifts)}.`);
    const { error } = await cloud.client
      .from(CLOUD_TABLE)
      .upsert({
        user_id: cloud.user.id,
        data: payload,
        updated_at: payload.updatedAt,
      }, { onConflict: "user_id" });
    if (error) throw error;
    cloud.remoteUpdatedAt = payload.updatedAt;
    state = normalizeState(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const savedData = await fetchCloudProfile();
    const savedState = savedData?.data
      ? normalizeState({ ...savedData.data, updatedAt: savedData.data.updatedAt || savedData.updated_at }, state)
      : state;
    setCloudStatus(`${successMessage} Server potvrdil ${savedState.shifts.length} smen.`);
  } catch (error) {
    setCloudStatus(`Cloud se nepodařilo uložit: ${friendlyCloudError(error)}`);
  }
}

function setCloudStatus(message) {
  cloud.status = message;
  renderCloud();
}

function renderCloud() {
  if (!els.cloudStatus) return;
  els.screenTitle.textContent = userLabel();
  els.cloudStatus.textContent = cloud.status;
  els.cloudSignedOut?.classList.toggle("hidden", !!cloud.user);
  els.cloudSignedIn?.classList.toggle("hidden", !cloud.user);
  if (cloud.user) els.passwordResetBox?.classList.add("hidden");
  if (els.cloudUser) els.cloudUser.textContent = cloud.user?.email || "-";
  if (els.cloudLocalCount) els.cloudLocalCount.textContent = `${state.shifts.length} smen: ${shiftSummary(state.shifts)}`;
}

function userLabel() {
  return `Uživatel: ${cloud.user?.email || "nepřihlášen"}`;
}

function shiftSummary(shifts) {
  if (!shifts.length) return "zadne";
  return shifts.map((shift) => `${shift.date} ${shift.title}`).join(", ");
}

function friendlyCloudError(error) {
  const message = error?.message || String(error || "neznama chyba");
  if (/invalid login credentials/i.test(message)) {
    return "e-mail nebo heslo nesouhlasí. Pokud byl účet vytvořen přes e-mailový odkaz, použij „Poslat přihlašovací odkaz“.";
  }
  if (/email not confirmed/i.test(message)) {
    return "e-mail ještě není potvrzený. Použij „Poslat potvrzení znovu“.";
  }
  if (message.includes(CLOUD_TABLE) || message.includes("schema cache")) {
    return "chybí cloudová tabulka. Spusť SQL soubor WebAPP/supabase-schema.sql v Supabase.";
  }
  return message;
}

async function importPdfFile() {
  const file = els.pdfInput.files?.[0];
  if (!file) return;
  els.importStatus.textContent = "Ctu PDF...";
  try {
    const text = await extractPdfText(file);
    const result = parseVehicleLogText(text);
    if (!result) throw new Error("V PDF jsem nenasla datum ani kilometry.");
    els.importDate.value = result.date;
    els.importKm.value = numberTextForInput(result.kilometers);
    els.importStatus.textContent = `PDF načteno: ${dateLabel(result.date)}, ${km(result.kilometers)}. Zkontroluj službu a ulož.`;
  } catch (error) {
    els.importStatus.textContent = error.message || "PDF se nepodarilo precist.";
  }
}

async function importImageFile() {
  const file = els.imageInput.files?.[0];
  if (!file) return;
  els.importStatus.textContent = "Ctu screenshot...";
  try {
    const text = await recognizeImageText(file);
    const result = selectedImportService === "Bolt" ? parseBoltEarningsText(text) : parseEarningsText(text);
    if (selectedImportService === "Bolt") {
      result.kilometers = await recognizeBoltKilometers(file) || result.kilometers;
    }
    if (!result.income && !result.hours && !result.kilometers) throw new Error("Ve screenshotu jsem nenašla údaje směny.");
    if (result.date) els.importDate.value = result.date;
    if (result.kilometers) els.importKm.value = numberTextForInput(result.kilometers);
    if (result.income) els.importIncome.value = numberTextForInput(result.income);
    if (result.hours) els.importHours.value = numberTextForInput(result.hours);
    const found = [
      result.date ? dateLabel(result.date) : null,
      result.kilometers ? km(result.kilometers) : null,
      result.income ? money(result.income) : null,
      result.hours ? hours(result.hours) : null,
    ].filter(Boolean).join(", ");
    els.importStatus.textContent = `Screenshot načten: ${found}. Zkontroluj službu a ulož.`;
  } catch (error) {
    els.importStatus.textContent = error.message || "Screenshot se nepodarilo precist.";
  }
}

async function extractPdfText(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  try {
    const pdfjs = await loadPdfjs();
    const document = await pdfjs.getDocument({ data }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str || "").join("\n"));
    }
    return pages.join("\n");
  } catch {
    return extractPdfTextFallback(data);
  }
}

async function loadPdfjs() {
  const pdfjs = await import(PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return pdfjs;
}

async function extractPdfTextFallback(data) {
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("PDF knihovnu se nepodarilo nacist.");
  }

  const source = new TextDecoder("latin1").decode(data);
  const chunks = [];
  const streamPattern = /stream\r?\n/g;
  let match;
  while ((match = streamPattern.exec(source))) {
    const start = match.index + match[0].length;
    const end = source.indexOf("endstream", start);
    if (end < 0) break;
    const chunk = trimPdfStream(data.slice(start, end));
    const decoded = await inflatePdfChunk(chunk).catch(() => "");
    if (decoded) chunks.push(extractPdfLiteralText(decoded));
  }

  const text = chunks.join("\n").trim();
  if (!text) throw new Error("V PDF jsem nenasla citelny text.");
  return text;
}

function trimPdfStream(chunk) {
  let end = chunk.length;
  while (end > 0 && [10, 13, 32].includes(chunk[end - 1])) end -= 1;
  return chunk.slice(0, end);
}

async function inflatePdfChunk(chunk) {
  const formats = ["deflate", "deflate-raw"];
  for (const format of formats) {
    try {
      const stream = new Blob([chunk]).stream().pipeThrough(new DecompressionStream(format));
      return await new Response(stream).text();
    } catch {
      continue;
    }
  }
  throw new Error("PDF stream se nepodarilo rozbalit.");
}

function extractPdfLiteralText(content) {
  return [...content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
    .map((match) => match[1]
      .replace(/\\([()\\])/g, "$1")
      .replace(/\\r|\\n/g, " ")
      .trim())
    .filter(Boolean)
    .join("\n");
}

async function recognizeImageText(file) {
  await loadTesseract();
  const result = await globalThis.Tesseract.recognize(file, "ces+eng", {
    logger(message) {
      if (message.status === "recognizing text" && Number.isFinite(message.progress)) {
        els.importStatus.textContent = `Ctu screenshot... ${Math.round(message.progress * 100)} %`;
      }
    },
  });
  return result?.data?.text || "";
}

function loadTesseract() {
  if (globalThis.Tesseract) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TESSERACT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("OCR knihovnu se nepodarilo nacist."));
    document.head.append(script);
  });
}

async function recognizeBoltKilometers(file) {
  const image = await createImageBitmap(file);
  try {
    const scale = 4;
    const x = Math.round(image.width * 0.04);
    const y = Math.round(image.height * 0.75);
    const width = Math.round(image.width * 0.72);
    const height = Math.round(image.height * 0.14);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const light = (pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2]) / 3;
      const value = light > 105 ? 0 : 255;
      pixels.data[index] = value;
      pixels.data[index + 1] = value;
      pixels.data[index + 2] = value;
    }
    context.putImageData(pixels, 0, 0);

    const result = await globalThis.Tesseract.recognize(canvas, "eng", {
      tessedit_char_whitelist: "0123456789.,",
    });
    const match = String(result?.data?.text || "").match(/\d{1,3}[,.]\d{1,2}/);
    const kilometers = match ? number(match[0]) : 0;
    return kilometers > 0 && kilometers < 1000 ? kilometers : null;
  } finally {
    image.close();
  }
}

function parseVehicleLogText(text) {
  const compacted = normalizeText(text).replace(/\s+/g, " ");
  const rowPattern = /sluzebni\s+(\d{1,2}[.\/-]\s*\d{1,2}(?:[.\/-]\s*\d{2,4})?)\s+\d{1,2}:\d{2}\s+\d{1,2}[.\/-]\s*\d{1,2}(?:[.\/-]\s*\d{2,4})?\s+\d{1,2}:\d{2}\s+\d+(?:[,.]\d+)?\s+(\d+(?:[,.]\d+)?)/g;
  const rows = [...compacted.matchAll(rowPattern)]
    .map((match) => ({
      date: parseImportDate(match[1]),
      kilometers: number(match[2]),
    }))
    .filter((row) => row.date && row.kilometers > 0 && row.kilometers < 1000);

  if (rows.length) {
    return {
      date: rows[0].date,
      kilometers: rows.reduce((total, row) => total + row.kilometers, 0),
    };
  }

  const date = parseImportDate(text);
  const kmMatch = compacted.match(/(?:celkem|ujeto|vzdalenost|kilometry|km)\s*:?\s*(\d+(?:[,.]\d+)?)\s*(?:km)?/);
  if (date && kmMatch) return { date, kilometers: number(kmMatch[1]) };
  return null;
}

function parseEarningsText(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const date = parseImportDate(text);
  const income = preferredMoneyAfter(lines, "celkovy prijem") || bestMoney(lines);
  const drivenHours = preferredHoursAfter(lines, ["odjezd", "odjezdene hodiny"]) || bestHours(lines);
  return { date, income, hours: drivenHours };
}

function parseBoltEarningsText(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return {
    date: parseImportDate(text) || (normalizeText(text).includes("dnes") ? toDateInput(new Date()) : null),
    income: valueNextToLabel(lines, ["hruby zisk"]),
    kilometers: boltKilometers(lines),
    hours: null,
  };
}

function valueNextToLabel(lines, labels) {
  const index = lines.findIndex((line) => labels.some((label) => normalizeText(line).includes(label)));
  if (index < 0) return null;
  for (const candidate of [lines[index - 1], lines[index + 1], lines[index]]) {
    const match = String(candidate || "").match(/-?\d[\d\s]*[,.]?\d*/);
    if (match) return number(match[0].replace(/\s/g, ""));
  }
  return null;
}

function preferredMoneyAfter(lines, label) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!normalizeText(lines[index]).includes(label)) continue;
    const windowText = lines.slice(index, index + 3);
    const values = [
      ...moneyCandidates(windowText.join(" ")),
      ...windowText.flatMap(moneyCandidates),
    ].sort(scoreSort);
    if (values[0]) return values[0].value;
  }
  return null;
}

function boltKilometers(lines) {
  const labels = ["ujeta vzdalenost", "vzdalenost (km)", "vzdalenost km"];
  const labelIndex = lines.findIndex((line) => labels.some((label) => normalizeText(line).includes(label)));
  if (labelIndex < 0) return null;

  const candidates = [
    lines[labelIndex],
    lines[labelIndex - 1],
    lines[labelIndex + 1],
    lines[labelIndex - 2],
    lines[labelIndex + 2],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate || "");
    if (!normalized || normalized.includes("kc") || normalized.includes("czk")) continue;
    const values = [...String(candidate).matchAll(/\d{1,3}(?:[\s.,]\d{1,2})?/g)]
      .map((match) => number(match[0].replace(/\s/g, "")))
      .filter((value) => value > 0 && value < 1000);
    if (values.length) return values[0];
  }
  return null;
}

function bestMoney(lines) {
  const joinedCandidates = lines
    .flatMap((_, index) => moneyCandidates(lines.slice(index, index + 3).join(" ")));
  return [...joinedCandidates, ...lines.flatMap(moneyCandidates)].sort(scoreSort)[0]?.value || null;
}

function moneyCandidates(line) {
  const lower = normalizeText(line);
  const matches = [...line.matchAll(/(\d[\d\s.,'’`´]*(?:[,.]\s*\d{1,2})?)\s*(?:kc|czk|kč)?/gi)];
  return matches.map((match) => {
    const value = parseMoneyValue(match[1], lower);
    let score = 0;
    if (value < 50) return null;
    if (lower.includes("celkovy prijem")) score += 10;
    if (lower.includes("prijem") || lower.includes("vydelek")) score += 5;
    if (lower.includes("kc") || lower.includes("czk")) score += 2;
    if (lower.includes("zaklad")) score -= 2;
    if (lower.includes("spropitne") || lower.includes("hodinovy prumer")) score -= 4;
    if (lower.includes("km")) score -= 5;
    if (lower.includes("objedn")) score -= 3;
    return { value, score };
  }).filter(Boolean);
}

function parseMoneyValue(value, context = "") {
  const cleaned = String(value)
    .replace(/[^\d,.\s]/g, "")
    .replace(/\s+/g, "");
  if (!cleaned) return 0;

  const separatorMatch = cleaned.match(/^(\d+)[,.](\d{1,2})$/);
  if (separatorMatch) {
    return Number(`${separatorMatch[1]}.${separatorMatch[2].padEnd(2, "0")}`) || 0;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return 0;

  if ((context.includes("kc") || context.includes("czk") || context.includes("prijem") || context.includes("vydelek"))
      && digits.length >= 5) {
    return Number(`${digits.slice(0, -2)}.${digits.slice(-2)}`) || 0;
  }

  return Number(digits) || 0;
}

function preferredHoursAfter(lines, labels) {
  for (let index = 0; index < lines.length; index += 1) {
    const lower = normalizeText(lines[index]);
    if (!labels.some((label) => lower.includes(label))) continue;
    const values = lines.slice(index, index + 3).flatMap(hourCandidates).sort(scoreSort);
    if (values[0]) return values[0].value;
  }
  return null;
}

function bestHours(lines) {
  return lines.flatMap(hourCandidates).sort(scoreSort)[0]?.value || null;
}

function hourCandidates(line) {
  const lower = normalizeText(line);
  const patterns = [
    /(\d{1,2})\s*h\s*(\d{1,2})\s*m/gi,
    /(\d{1,2})\s*[:.]\s*([0-5]\d)/gi,
    /(\d{1,2}(?:[,.]\d{1,2})?)\s*(?:h|hod|hodin)/gi,
  ];
  const results = [];
  for (const pattern of patterns) {
    for (const match of line.matchAll(pattern)) {
      const value = match[2] == null
        ? number(match[1])
        : number(match[1]) + number(match[2]) / 60;
      if (!value || value > 24) continue;
      let score = 0;
      if (lower.includes("hod")) score += 3;
      if (lower.includes("odjezd") || lower.includes("online")) score += 5;
      if (lower.includes("kc") || lower.includes("czk") || lower.includes("km")) score -= 5;
      if (lower.includes(" - ")) score -= 3;
      results.push({ value, score });
    }
  }
  return results;
}

function parseImportDate(text) {
  const match = String(text).match(/(?<!\d)(\d{1,2})[.\/-]\s*(\d{1,2})(?:[.\/-]\s*(\d{2,4}))?\.?(?!\d)/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const currentYear = new Date().getFullYear();
  const parsedYear = match[3] ? Number(match[3]) : currentYear;
  const year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeText(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function scoreSort(left, right) {
  return left.score === right.score ? right.value - left.value : right.score - left.score;
}

function numberTextForInput(value) {
  return String(Math.round((value || 0) * 100) / 100);
}

function saveImport() {
  if (!selectedImportService) {
    els.importWarning.classList.remove("hidden");
    els.importStatus.textContent = "Nejdřív vyber službu.";
    return;
  }
  const date = els.importDate.value || toDateInput(new Date());
  let saved = 0;
  if (number(els.importKm.value) > 0) {
    addOrMerge({ date, title: selectedImportService, kilometers: number(els.importKm.value) });
    saved += 1;
  }
  if (number(els.importIncome.value) > 0 || number(els.importHours.value) > 0) {
    addOrMerge({
      date,
      title: selectedImportService,
      income: number(els.importIncome.value),
      hours: number(els.importHours.value),
    });
    saved += 1;
  }
  if (!saved) {
    els.importStatus.textContent = "Není co uložit.";
    return;
  }
  els.importKm.value = "";
  els.importIncome.value = "";
  els.importHours.value = "";
  els.pdfInput.value = "";
  els.imageInput.value = "";
  els.importStatus.textContent = "Import uložen.";
  els.importDialog.close();
  saveAndRender();
}

function showImportServiceStep() {
  selectedImportService = null;
  els.importDialogTitle.textContent = "Přidat směnu";
  els.importServiceStep.classList.remove("hidden");
  els.importFields.classList.add("hidden");
  renderImportServices();
}

function showImportForm(service) {
  const isBolt = service === "Bolt";
  els.importDialogTitle.textContent = service;
  els.importServiceStep.classList.add("hidden");
  els.importFields.classList.remove("hidden");
  els.importDriveSection.classList.remove("hidden");
  els.pdfInput.closest(".file-row").classList.toggle("hidden", isBolt);
  els.importDriveSection.querySelector("h3").textContent = isBolt ? "Údaje směny" : "Kniha jízd";
  els.importHoursRow.classList.toggle("hidden", isBolt);
  els.imageInput.closest("section").querySelector("h3").textContent = isBolt ? "Screenshot aktivity" : "Výdělek";
  els.importStatus.textContent = isBolt ? "Nahraj jeden screenshot Boltu. Načtu datum, kilometry a výdělek." : "";
}

function openImportDialog() {
  els.importDate.value = `${state.selectedMonth}-01`;
  els.importKm.value = "";
  els.importIncome.value = "";
  els.importHours.value = "";
  els.importStatus.textContent = "";
  els.importWarning.classList.add("hidden");
  showImportServiceStep();
  els.importDialog.showModal();
}

function openShiftDialog(shift = null) {
  els.shiftDialogTitle.textContent = shift ? "Upravit směnu" : "Nová směna";
  els.shiftId.value = shift?.id || "";
  els.shiftDate.value = shift?.date || `${state.selectedMonth}-01`;
  els.shiftTitle.value = shift?.title || SERVICES[0];
  els.shiftKm.value = shift?.kilometers || "";
  els.shiftHours.value = shift?.hours || "";
  els.shiftIncome.value = shift?.income || "";
  els.shiftNotes.value = shift?.notes || "";
  els.deleteShiftButton.classList.toggle("hidden", !shift);
  els.shiftDialog.showModal();
}

function saveShiftFromDialog() {
  const shift = normalizeShift({
    id: els.shiftId.value || createId(),
    date: els.shiftDate.value,
    title: els.shiftTitle.value,
    kilometers: els.shiftKm.value,
    hours: els.shiftHours.value,
    income: els.shiftIncome.value,
    notes: els.shiftNotes.value,
  });
  const index = state.shifts.findIndex((item) => item.id === shift.id);
  if (index >= 0) state.shifts[index] = shift;
  else state.shifts.push(shift);
  state.shifts.sort(sortByDate);
  state.selectedMonth = monthKey(shift.date);
  els.shiftDialog.close();
  saveAndRender();
}

function openShiftDetail(id) {
  const shift = state.shifts.find((item) => item.id === id);
  if (!shift) return;
  selectedShiftId = id;
  const breakdown = breakdownFor(shift);
  els.detailTitle.textContent = dateLabel(shift.date);
  els.detailGrid.innerHTML = [
    ["Výdělek", money(shift.income)],
    ["Hodinový obrat", breakdown.hourlyRevenue == null ? "Bez hodin" : money(breakdown.hourlyRevenue)],
    ["Kilometry", km(shift.kilometers)],
    ["Hodiny", hours(shift.hours)],
    ["Náklady na km", money(breakdown.fuelCost + breakdown.amortizationShare)],
    ["Čistý zisk", money(breakdown.profit), breakdown.profit >= 0 ? "good" : "bad"],
  ].map(metricMarkup).join("");
  els.detailDialog.showModal();
}

function deleteShift(id) {
  state.shifts = state.shifts.filter((shift) => shift.id !== id);
  saveAndRender();
}

function deleteMonth(month) {
  if (!confirm(`Smazat celý přehled ${shortMonthLabel(month)}?`)) return;
  state.shifts = state.shifts.filter((shift) => monthKey(shift.date) !== month);
  if (state.selectedMonth === month) {
    state.selectedMonth = historyMonths()[0] || currentMonth();
  }
  saveAndRender();
}

function addOrMerge(partial) {
  const service = normalizeService(partial.title);
  const existing = state.shifts.find((shift) => shift.date === partial.date && shift.title === service);
  if (existing) {
    Object.assign(existing, {
      title: service,
      kilometers: partial.kilometers ?? existing.kilometers,
      income: partial.income ?? existing.income,
      hours: partial.hours ?? existing.hours,
    });
  } else {
    state.shifts.push(normalizeShift({
      date: partial.date,
      title: partial.title,
      kilometers: partial.kilometers ?? 0,
      income: partial.income ?? 0,
      hours: partial.hours ?? 0,
    }));
  }
  state.shifts.sort(sortByDate);
  state.selectedMonth = monthKey(partial.date);
}

function displayedShifts() {
  return shiftsInMonth(state.selectedMonth).filter((shift) => selectedServices.has(shift.title));
}

function shiftsInMonth(month) {
  return state.shifts.filter((shift) => monthKey(shift.date) === month).sort(sortByDate);
}

function historyMonths() {
  const months = [...new Set(state.shifts.map((shift) => monthKey(shift.date)))];
  return months.sort((a, b) => state.preferences.historySortAscending ? a.localeCompare(b) : b.localeCompare(a));
}

function totalsFor(shifts) {
  const breakdowns = shifts.map(breakdownFor);
  const income = sum(shifts, "income");
  const kilometers = sum(shifts, "kilometers");
  const totalHours = sum(shifts, "hours");
  const fuel = breakdowns.reduce((total, item) => total + item.fuelCost, 0);
  const taxes = breakdowns.reduce((total, item) => total + item.osvcShare, 0);
  const rent = breakdowns.reduce((total, item) => total + item.vehicleRentShare, 0);
  const amortization = breakdowns.reduce((total, item) => total + item.amortizationShare, 0);
  const costs = fuel + taxes + rent + amortization;
  const profit = income - costs;
  return {
    income,
    kilometers,
    hours: totalHours,
    fuel,
    taxes,
    rent,
    amortization,
    costs,
    profit,
    profitPerHour: totalHours > 0 ? profit / totalHours : null,
  };
}

function breakdownFor(shift) {
  const fuelLiters = shift.kilometers * state.expense.consumptionLitersPer100km / 100;
  const fuelCost = fuelLiters * state.expense.fuelPricePerLiter;
  const monthHours = sum(shiftsInMonth(monthKey(shift.date)), "hours");
  const reserve = businessEstimate().monthlyReserve;
  const osvcShare = monthHours > 0 ? reserve / monthHours * shift.hours : 0;
  const vehicleRentShare = monthHours > 0 ? state.expense.vehicleRent / monthHours * shift.hours : 0;
  const amortizationShare = shift.kilometers * amortizationRatePerKm();
  const totalCost = fuelCost + osvcShare + vehicleRentShare + amortizationShare;
  const profit = shift.income - totalCost;
  return {
    fuelLiters,
    fuelCost,
    osvcShare,
    vehicleRentShare,
    amortizationShare,
    totalCost,
    profit,
    profitPerHour: shift.hours > 0 ? profit / shift.hours : null,
    hourlyRevenue: shift.hours > 0 ? shift.income / shift.hours : null,
  };
}

function averageFuelCostPerShift(shifts) {
  const shiftsWithKilometers = shifts.filter((shift) => number(shift.kilometers) > 0);
  if (!shiftsWithKilometers.length) return null;
  return shiftsWithKilometers.reduce((total, shift) => total + breakdownFor(shift).fuelCost, 0) / shiftsWithKilometers.length;
}

function amortizationRatePerKm() {
  const year = Number(state.expense.productionYear) || 2020;
  const ageCoefficient = year >= 2020 ? 1.2 : year >= 2010 ? 1.0 : year >= 2000 ? 1.3 : 1.6;
  const fuelCoefficient = { gasoline: 1.0, diesel: 1.4, lpg: 1.15 }[state.expense.fuelType] || 1;
  return 2.0 * ageCoefficient * fuelCoefficient;
}

function averageIncomePerShift() {
  const paid = state.shifts.filter((shift) => shift.income > 0);
  return paid.length ? sum(paid, "income") / paid.length : 0;
}

function businessEstimate() {
  return businessEstimateFor(averageIncomePerShift(), state.business);
}

function businessEstimateFor(averageIncome, business) {
  const monthlyRevenue = averageIncome * business.monthlyShiftCount;
  const annualRevenue = monthlyRevenue * 12;
  const flatExpenses = Math.min(
    annualRevenue * business.flatExpenseRate,
    BUSINESS_RULES_2026.flatExpenseRevenueCap * business.flatExpenseRate,
  );
  const profitBase = Math.max(0, annualRevenue - flatExpenses);
  const incomeTax = calculateIncomeTax(profitBase);
  const calculatedSocial = profitBase * BUSINESS_RULES_2026.socialAssessmentShare * BUSINESS_RULES_2026.socialRate;
  const social = business.isSideIncome
    ? (profitBase <= BUSINESS_RULES_2026.socialSideDecisionAmount
      ? 0
      : Math.max(calculatedSocial, BUSINESS_RULES_2026.socialSideMonthlyMinimum * 12))
    : Math.max(calculatedSocial, BUSINESS_RULES_2026.socialMainMonthlyMinimum * 12);
  const calculatedHealth = profitBase * BUSINESS_RULES_2026.healthAssessmentShare * BUSINESS_RULES_2026.healthRate;
  const health = business.isSideIncome
    ? calculatedHealth
    : Math.max(calculatedHealth, BUSINESS_RULES_2026.healthMainMonthlyMinimum * 12);
  return {
    monthlyRevenue,
    annualRevenue,
    monthlyIncomeTax: incomeTax / 12,
    monthlySocialInsurance: social / 12,
    monthlyHealthInsurance: health / 12,
    monthlyReserve: (incomeTax + social + health) / 12,
  };
}

function calculateIncomeTax(taxBase) {
  const grossTax = Math.min(taxBase, BUSINESS_RULES_2026.higherTaxThreshold) * 0.15
    + Math.max(0, taxBase - BUSINESS_RULES_2026.higherTaxThreshold) * 0.23;
  return Math.max(0, grossTax - BUSINESS_RULES_2026.basicTaxpayerCredit);
}

function runCalculationSelfCheck() {
  const main = businessEstimateFor(2500, { monthlyShiftCount: 20, flatExpenseRate: 0.6, isSideIncome: false });
  const sideLow = businessEstimateFor(1000, { monthlyShiftCount: 10, flatExpenseRate: 0.6, isSideIncome: true });
  const capped = businessEstimateFor(12500, { monthlyShiftCount: 20, flatExpenseRate: 0.6, isSideIncome: false });
  const checks = [
    closeEnough(main.annualRevenue, 600000),
    closeEnough(main.monthlyIncomeTax * 12, 5160),
    closeEnough(main.monthlySocialInsurance * 12, 60060),
    closeEnough(main.monthlyHealthInsurance * 12, 39672),
    closeEnough(sideLow.monthlyIncomeTax, 0),
    closeEnough(sideLow.monthlySocialInsurance, 0),
    closeEnough(sideLow.monthlyHealthInsurance * 12, 3240),
    closeEnough(capped.monthlyIncomeTax * 12, 242135.04),
  ];
  const valid = checks.every(Boolean);
  document.documentElement.dataset.calculationStatus = valid ? "valid" : "invalid";
  els.calculationWarning?.classList.toggle("hidden", valid);
  if (!valid) console.error("Automatická kontrola OSVČ výpočtů selhala.", checks);
}

function closeEnough(actual, expected) {
  return Math.abs(actual - expected) < 0.01;
}

function createDemoData() {
  state = demoState();
}

function demoState() {
  const demoMonths = ["2026-06", "2026-07", "2026-08", "2026-09"];
  const shifts = demoMonths.flatMap((month, monthIndex) => demoShiftsForMonth(month, monthIndex));
  return normalizeState({
    shifts,
    selectedMonth: demoMonths[0],
    expense: { ...defaults.expense, consumptionLitersPer100km: 8.5, fuelPricePerLiter: 39, vehicleRent: 1800 },
    business: { ...defaults.business, monthlyShiftCount: 20, flatExpenseRate: 0.8 },
    preferences: defaults.preferences,
    demoDataVersion: DEMO_DATA_VERSION,
  });
}

function demoShiftsForMonth(month, monthIndex) {
  const samples = [
    [49.5, 4.4, 3180], [56.2, 4.8, 3360], [61.4, 5.2, 3580], [68.6, 5.7, 3920],
    [73.1, 6.1, 4210], [58.2, 4.9, 3540], [70.4, 5.8, 4380], [66.5, 5.5, 4120],
  ];
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const offset = monthIndex * 3;
  return samples.map((sample, index) => {
    const day = Math.min(daysInMonth, 2 + Math.round(index * (daysInMonth - 4) / (samples.length - 1)));
    const monthFactor = 1 + monthIndex * 0.035;
    return normalizeShift({
      date: `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      title: SERVICES[(index + offset) % SERVICES.length],
      kilometers: sample[0] + monthIndex * 2.4,
      hours: sample[1],
      income: Math.round(sample[2] * monthFactor),
      notes: `Zkušební přehled: ${MONTH_NAMES[monthNumber - 1].toLowerCase()}.`,
    });
  });
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "naklady-smen-zaloha.json";
  link.click();
  URL.revokeObjectURL(url);
  els.backupStatus.textContent = "Záloha vytvořena.";
}

async function importBackup() {
  const file = els.backupInput.files?.[0];
  if (!file) return;
  try {
    state = normalizeState(JSON.parse(await file.text()));
    saveAndRender();
    applyTheme();
    els.backupStatus.textContent = "Záloha nahrána.";
  } catch {
    els.backupStatus.textContent = "Zálohu se nepodařilo nahrát.";
  } finally {
    els.backupInput.value = "";
  }
}

function exportPdf() {
  const shifts = displayedShifts();
  const totals = totalsFor(shifts);
  const rows = shifts.map((shift) => {
    const breakdown = breakdownFor(shift);
    return `<tr><td>${dateLabel(shift.date)}</td><td>${escapeHtml(shift.title)}</td><td>${money(shift.income)}</td><td>${km(shift.kilometers)}</td><td>${hours(shift.hours)}</td><td>${money(breakdown.profit)}</td></tr>`;
  }).join("");
  const html = `
    <html><head><meta charset="utf-8"><title>Přehled ${state.selectedMonth}</title>
    <style>body{font-family:-apple-system,Segoe UI,sans-serif;margin:32px;color:#111}h1{margin:0}.meta{color:#666}.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:20px 0}.box{border:1px solid #ddd;border-radius:8px;padding:10px;text-align:center}.box span{display:block;color:#666;font-size:11px}.box strong{font-size:17px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}td:nth-child(n+3),th:nth-child(n+3){text-align:right}</style>
    </head><body>
    <h1>${longMonthLabel(state.selectedMonth)}</h1><p class="meta">${escapeHtml(userLabel())}</p>
    <section class="summary"><div class="box"><span>Zisk</span><strong>${money(totals.profit)}</strong></div><div class="box"><span>Hodiny</span><strong>${hours(totals.hours)}</strong></div><div class="box"><span>Kilometry</span><strong>${km(totals.kilometers)}</strong></div><div class="box"><span>Obrat</span><strong>${money(totals.income)}</strong></div><div class="box"><span>Náklady</span><strong>${money(totals.costs)}</strong></div></section>
    <table><thead><tr><th>Datum</th><th>Směna</th><th>Obrat</th><th>Kilometry</th><th>Hodiny</th><th>Čistý zisk</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>
  `;
  const printWindow = window.open("", "_blank");
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function applyTheme() {
  const resolved = resolvedTheme();
  document.documentElement.dataset.theme = resolved;
  if (els.themeToggle) els.themeToggle.checked = resolved === "dark";
}

function resolvedTheme() {
  const theme = state.preferences.theme;
  return theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;
}

function currentMonth() {
  return monthKey(new Date());
}

function nextMonth(value) {
  const [year, month] = value.split("-").map(Number);
  return monthKey(new Date(year, month, 1));
}

function monthKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateInput(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function sortByDate(a, b) {
  return a.date.localeCompare(b.date);
}

function normalizeService(value) {
  return SERVICES.includes(value) ? value : SERVICES[0];
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `shift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sum(items, key) {
  return items.reduce((total, item) => total + (number(item[key]) || 0), 0);
}

function maxBy(items, key) {
  return items.length ? items.reduce((best, item) => valueOf(item, key) > valueOf(best, key) ? item : best) : null;
}

function minBy(items, key) {
  return items.length ? items.reduce((best, item) => valueOf(item, key) < valueOf(best, key) ? item : best) : null;
}

function valueOf(item, key) {
  if (key === "hourlyRevenue") return item.hours > 0 ? item.income / item.hours : 0;
  return item[key] ?? 0;
}

function number(value) {
  return Number(String(value ?? 0).replace(",", ".")) || 0;
}

function money(value) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function km(value) {
  return `${numberText(value)} km`;
}

function hours(value) {
  return value > 0 ? `${numberText(value)} h` : "0 h";
}

function numberText(value) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value || 0);
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(new Date(value));
}

function dateTime(value) {
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function shortMonthLabel(value) {
  const [year, month] = value.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${String(year).slice(-2)}`;
}

function longMonthLabel(value) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function dayLabel(value) {
  return String(new Date(value).getDate());
}

function weekday(value) {
  return new Intl.DateTimeFormat("cs-CZ", { weekday: "short" }).format(new Date(value)).replace(".", "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js?v=140").then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {});
  }
}
