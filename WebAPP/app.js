const STORAGE_KEY = "naklady-smen-profiles-v1";
const LEGACY_STORAGE_KEY = "naklady-smen-web-v1";
const PROFILE_PLACEHOLDER_NAME = "Název profilu";
const DEMO_PROFILE_NAME = "Název profilu";
const OLD_DEMO_PROFILE_NAME = "Zkušební profil";
const DEMO_PROFILE_VERSION = 4;
const SERVICE_OPTIONS = ["Wolt", "Foodora", "Bolt"];
const FUEL_PRICE_SOURCE_NAME = "mBenzin.cz";
const FUEL_PRICE_SOURCE_URL = "https://www.mbenzin.cz/";
const FUEL_PRICE_PROXY_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(FUEL_PRICE_SOURCE_URL)}`;
let selectedServices = new Set(SERVICE_OPTIONS);
let pendingPdfImports = [];

const profileStore = loadProfileStore();
let state = getActiveProfile();
const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  setDefaults();
  render();
  refreshFuelPriceIfOnline();
  registerServiceWorker();
});

function cacheElements() {
  Object.assign(els, {
    tabs: [...document.querySelectorAll(".tabbar button")],
    views: [...document.querySelectorAll(".view")],
    headerTitle: document.querySelector("#headerTitle"),
    headerSubtitle: document.querySelector("#headerSubtitle"),
    monthDisplayButton: document.querySelector("#monthDisplayButton"),
    newOverviewButton: document.querySelector("#newOverviewButton"),
    exportPdfButton: document.querySelector("#exportPdfButton"),
    serviceFilter: document.querySelector("#serviceFilter"),
    monthPicker: document.querySelector("#monthPicker"),
    metricsGrid: document.querySelector("#metricsGrid"),
    metricIncome: document.querySelector("#metricIncome"),
    metricKm: document.querySelector("#metricKm"),
    metricFuel: document.querySelector("#metricFuel"),
    fuelPriceMeta: document.querySelector("#fuelPriceMeta"),
    metricTaxes: document.querySelector("#metricTaxes"),
    metricRent: document.querySelector("#metricRent"),
    metricRentTile: document.querySelector("#metricRentTile"),
    metricCosts: document.querySelector("#metricCosts"),
    metricProfit: document.querySelector("#metricProfit"),
    metricHourly: document.querySelector("#metricHourly"),
    profitChart: document.querySelector("#profitChart"),
    overviewList: document.querySelector("#overviewList"),
    shiftList: document.querySelector("#shiftList"),
    historySortSelect: document.querySelector("#historySortSelect"),
    shiftDialog: document.querySelector("#shiftDialog"),
    shiftDetailDialog: document.querySelector("#shiftDetailDialog"),
    shiftForm: document.querySelector("#shiftForm"),
    shiftDialogTitle: document.querySelector("#shiftDialogTitle"),
    shiftDetailTitle: document.querySelector("#shiftDetailTitle"),
    shiftDetailGrid: document.querySelector("#shiftDetailGrid"),
    shiftDetailMap: document.querySelector("#shiftDetailMap"),
    editShiftDetailButton: document.querySelector("#editShiftDetailButton"),
    deleteShiftDetailButton: document.querySelector("#deleteShiftDetailButton"),
    closeShiftDetailButton: document.querySelector("#closeShiftDetailButton"),
    deleteShiftButton: document.querySelector("#deleteShiftButton"),
    settingsForm: document.querySelector("#settingsForm"),
    profileSelect: document.querySelector("#profileSelect"),
    profileNameInput: document.querySelector("#profileNameInput"),
    newProfileButton: document.querySelector("#newProfileButton"),
    deleteProfileButton: document.querySelector("#deleteProfileButton"),
    themeSelect: document.querySelector("#themeSelect"),
    wallpaperInput: document.querySelector("#wallpaperInput"),
    clearWallpaperButton: document.querySelector("#clearWallpaperButton"),
    backupInput: document.querySelector("#backupInput"),
    backupStatus: document.querySelector("#backupStatus"),
    aboutButton: document.querySelector("#aboutButton"),
    aboutDialog: document.querySelector("#aboutDialog"),
    closeAboutButton: document.querySelector("#closeAboutButton"),
    monthlyShiftCount: document.querySelector("#monthlyShiftCount"),
    averageShiftIncome: document.querySelector("#averageShiftIncome"),
    flatExpenseRate: document.querySelector("#flatExpenseRate"),
    sideIncomeToggle: document.querySelector("#sideIncomeToggle"),
    taxGrid: document.querySelector("#taxGrid"),
    taxStatus: document.querySelector("#taxStatus"),
    pdfInput: document.querySelector("#pdfInput"),
    pdfStatus: document.querySelector("#pdfStatus"),
    manualPdfDate: document.querySelector("#manualPdfDate"),
    manualPdfKm: document.querySelector("#manualPdfKm"),
    saveImportButton: document.querySelector("#saveImportButton"),
    earningsInput: document.querySelector("#earningsInput"),
    ocrStatus: document.querySelector("#ocrStatus"),
    manualEarningsDate: document.querySelector("#manualEarningsDate"),
    manualIncome: document.querySelector("#manualIncome"),
    manualHours: document.querySelector("#manualHours"),
    downloadBackupButton: document.querySelector("#downloadBackupButton"),
  });
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  els.monthPicker.addEventListener("change", () => {
    ensureOverview(els.monthPicker.value);
    saveState();
    render();
  });
  els.monthDisplayButton.addEventListener("click", () => {
    els.monthPicker.showPicker?.();
    if (!els.monthPicker.showPicker) els.monthPicker.click();
  });
  els.newOverviewButton.addEventListener("click", createOverview);
  els.exportPdfButton.addEventListener("click", exportCurrentOverviewPdf);
  document.querySelectorAll('input[name="title"], input[name="importService"]').forEach((input) => {
    input.addEventListener("change", () => setServiceWarning(input.closest(".service-picker"), false));
  });
  els.historySortSelect.addEventListener("change", updateHistorySort);
  els.shiftForm.addEventListener("submit", saveShiftFromDialog);
  els.closeShiftDetailButton.addEventListener("click", () => els.shiftDetailDialog.close());
  els.editShiftDetailButton.addEventListener("click", editShiftFromDetail);
  els.deleteShiftDetailButton.addEventListener("click", deleteShiftFromDetail);
  els.deleteShiftButton.addEventListener("click", deleteSelectedShift);
  els.settingsForm.addEventListener("input", updateSettings);
  els.settingsForm.addEventListener("change", updateSettings);
  els.profileSelect.addEventListener("change", switchProfile);
  els.profileNameInput.addEventListener("input", updateProfile);
  els.newProfileButton.addEventListener("click", createProfile);
  els.deleteProfileButton.addEventListener("click", deleteProfile);
  els.themeSelect.addEventListener("change", updateAppearance);
  els.aboutButton.addEventListener("click", () => els.aboutDialog.showModal());
  els.closeAboutButton.addEventListener("click", () => els.aboutDialog.close());
  els.wallpaperInput.addEventListener("change", updateWallpaper);
  els.clearWallpaperButton.addEventListener("click", clearWallpaper);
  els.backupInput.addEventListener("change", importBackup);
  els.monthlyShiftCount.addEventListener("input", updateBusinessEstimate);
  els.flatExpenseRate.addEventListener("input", updateBusinessEstimate);
  els.flatExpenseRate.addEventListener("change", updateBusinessEstimate);
  els.sideIncomeToggle.addEventListener("change", updateBusinessEstimate);
  els.pdfInput.addEventListener("change", handlePdfImport);
  els.earningsInput.addEventListener("change", handleEarningsImport);
  els.saveImportButton.addEventListener("click", saveImportData);
  els.downloadBackupButton.addEventListener("click", exportData);
}

function setDefaults() {
  const today = toDateInput(new Date());
  const month = today.slice(0, 7);
  els.monthPicker.value = month;
  els.manualPdfDate.value = today;
  els.manualEarningsDate.value = today;
  fillSettingsForm();
  fillProfileForm();
  fillHistorySort();
  els.monthlyShiftCount.value = state.business?.monthlyShiftCount ?? 20;
  syncAverageShiftIncomeField();
  els.flatExpenseRate.value = String(state.business?.flatExpenseRate ?? 0.8);
  els.sideIncomeToggle.checked = Boolean(state.business?.sideIncome);
}

function loadProfileStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.profiles?.length) return normalizeStore(saved);
  } catch {
    // Fall through to migration/defaults.
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacy) {
      const profile = normalizeProfile({
        ...legacy,
        id: crypto.randomUUID(),
        profile: {
          profileName: legacy.profile?.profileName || legacy.profile?.appName || PROFILE_PLACEHOLDER_NAME,
        },
      });
      return { activeProfileId: profile.id, profiles: [profile] };
    }
  } catch {
    // Fall through to defaults.
  }

  const profile = createDefaultProfile(PROFILE_PLACEHOLDER_NAME);
  const demoProfile = createDemoProfile();
  return { activeProfileId: profile.id, profiles: [profile, demoProfile] };
}

function normalizeStore(store) {
  const profiles = (store.profiles || []).map((item, index) => normalizeProfile(item, `Profil ${index + 1}`));
  if (!profiles.length) {
    const profile = createDefaultProfile(PROFILE_PLACEHOLDER_NAME);
    const demoProfile = createDemoProfile();
    return { activeProfileId: profile.id, profiles: [profile, demoProfile] };
  }
  const demoProfileIndex = profiles.findIndex((item) => item.demoVersion > 0 || item.profile?.profileName === OLD_DEMO_PROFILE_NAME);
  if (demoProfileIndex >= 0 && profiles[demoProfileIndex].demoVersion !== DEMO_PROFILE_VERSION) {
    profiles[demoProfileIndex] = createDemoProfile(profiles[demoProfileIndex].id);
  } else if (demoProfileIndex < 0) {
    profiles.push(createDemoProfile());
  }
  const activeProfileId = profiles.some((item) => item.id === store.activeProfileId)
    ? store.activeProfileId
    : profiles[0].id;
  return { activeProfileId, profiles };
}

function normalizeProfile(profileData, fallbackName = PROFILE_PLACEHOLDER_NAME) {
  return {
    id: profileData.id || crypto.randomUUID(),
    shifts: Array.isArray(profileData.shifts) ? profileData.shifts : [],
    overviews: Array.isArray(profileData.overviews) ? profileData.overviews : [],
    settings: {
      consumption: profileData.settings?.consumption ?? 10,
      fuelPrice: profileData.settings?.fuelPrice ?? 39,
      vehicleRent: profileData.settings?.vehicleRent ?? 0,
      fuelType: profileData.settings?.fuelType || "gasoline",
      productionYear: profileData.settings?.productionYear ?? 2020,
      amortizationMonthly: profileData.settings?.amortizationMonthly ?? 0,
      fuelPrices: {
        gasoline: profileData.settings?.fuelPrices?.gasoline ?? 0,
        diesel: profileData.settings?.fuelPrices?.diesel ?? 0,
        lpg: profileData.settings?.fuelPrices?.lpg ?? 0,
        updatedAt: profileData.settings?.fuelPrices?.updatedAt || "",
        source: profileData.settings?.fuelPrices?.source || FUEL_PRICE_SOURCE_NAME,
      },
      fixed: profileData.settings?.fixed || {
        social: 0,
        health: 0,
        sickness: 0,
        pension: 0,
        tax: 0,
      },
    },
    business: {
      monthlyShiftCount: profileData.business?.monthlyShiftCount ?? 20,
      averageShiftIncome: profileData.business?.averageShiftIncome ?? 0,
      flatExpenseRate: profileData.business?.flatExpenseRate ?? 0.8,
      sideIncome: Boolean(profileData.business?.sideIncome),
    },
    profile: {
      profileName: profileData.profile?.profileName || profileData.profile?.appName || fallbackName,
    },
    appearance: {
      theme: profileData.appearance?.theme || "system",
      wallpaper: profileData.appearance?.wallpaper || "",
    },
    preferences: {
      historySort: profileData.preferences?.historySort || "desc",
    },
    demoVersion: profileData.demoVersion || 0,
  };
}

function createDefaultProfile(profileName) {
  return normalizeProfile({
    id: crypto.randomUUID(),
    profile: { profileName },
  }, profileName);
}

function createDemoProfile(id = crypto.randomUUID()) {
  const month = toDateInput(new Date()).slice(0, 7);
  const demoShifts = createDemoShifts(month);
  const averageShiftIncome = demoShifts.reduce((sum, shift) => sum + shift.income, 0) / demoShifts.length;
  return normalizeProfile({
    id,
    demoVersion: DEMO_PROFILE_VERSION,
    profile: { profileName: DEMO_PROFILE_NAME },
    overviews: [{ month, createdAt: new Date().toISOString() }],
    settings: {
      consumption: 10,
      fuelPrice: 39,
      vehicleRent: 4200,
      fuelType: "gasoline",
      productionYear: 2020,
      amortizationMonthly: 0,
      fuelPrices: {
        gasoline: 0,
        diesel: 0,
        lpg: 0,
        updatedAt: "",
        source: FUEL_PRICE_SOURCE_NAME,
      },
    },
    business: {
      monthlyShiftCount: demoShifts.length,
      averageShiftIncome,
      flatExpenseRate: 0.8,
      sideIncome: false,
    },
    shifts: demoShifts,
  }, DEMO_PROFILE_NAME);
}

function createDemoShifts(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const sampleDays = Array.from({ length: 20 }, (_, index) =>
    Math.min(daysInMonth, 1 + Math.round((index * (daysInMonth - 1)) / 19))
  );
  const samples = [
    { km: 49.5, hours: 4.4, income: 1760 },
    { km: 56.2, hours: 4.8, income: 1680 },
    { km: 61.4, hours: 5.2, income: 1880 },
    { km: 52.8, hours: 4.5, income: 1760 },
    { km: 68.6, hours: 5.7, income: 2110 },
    { km: 73.1, hours: 6.1, income: 2290 },
    { km: 45.7, hours: 3.9, income: 1080 },
    { km: 63.9, hours: 5.4, income: 2050 },
    { km: 58.2, hours: 4.9, income: 1960 },
    { km: 70.4, hours: 5.8, income: 2380 },
    { km: 54.9, hours: 4.6, income: 1780 },
    { km: 66.5, hours: 5.5, income: 2220 },
    { km: 80.2, hours: 6.4, income: 2470 },
    { km: 42.1, hours: 3.8, income: 1390 },
    { km: 59.6, hours: 5.0, income: 2130 },
    { km: 76.3, hours: 6.0, income: 2590 },
    { km: 50.4, hours: 4.2, income: 1730 },
    { km: 64.8, hours: 5.1, income: 2360 },
    { km: 47.9, hours: 4.0, income: 1560 },
    { km: 69.7, hours: 5.3, income: 2520 },
  ];

  return sampleDays.map((day, index) => ({
    id: crypto.randomUUID(),
    date: `${month}-${String(day).padStart(2, "0")}`,
    title: SERVICE_OPTIONS[index % SERVICE_OPTIONS.length],
    kilometers: samples[index].km,
    hours: samples[index].hours,
    income: samples[index].income,
    notes: "Modelová data pro náhled grafu a dlaždic",
    routeStops: [],
  }));
}

function getActiveProfile() {
  return profileStore.profiles.find((item) => item.id === profileStore.activeProfileId) || profileStore.profiles[0];
}

function saveState() {
  profileStore.activeProfileId = state.id;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profileStore));
}

function switchView(viewName) {
  if (viewName === "preferences") {
    fillProfileForm();
    setStatus(els.backupStatus, backupHelpText());
  }
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  els.views.forEach((view) => view.classList.toggle("active", view.id === `view-${viewName}`));
}

function fillSettingsForm() {
  const { settings } = state;
  els.settingsForm.elements.consumption.value = settings.consumption;
  els.settingsForm.elements.fuelPrice.value = settings.fuelPrice;
  els.settingsForm.elements.vehicleRent.value = settings.vehicleRent || "";
  els.settingsForm.elements.fuelType.value = settings.fuelType || "gasoline";
  els.settingsForm.elements.productionYear.value = settings.productionYear || "";
  els.settingsForm.elements.amortizationMonthly.value = `${formatInputNumber(amortizationRatePerKm(), 2)} Kč / km`;
  renderFuelPriceMeta();
}

function fillHistorySort() {
  els.historySortSelect.value = state.preferences?.historySort || "desc";
}

function updateHistorySort() {
  state.preferences = {
    ...(state.preferences || {}),
    historySort: els.historySortSelect.value === "asc" ? "asc" : "desc",
  };
  saveState();
  render();
}

function profile() {
  const savedProfile = state.profile || {};
  state.profile = {
    profileName: savedProfile.profileName || savedProfile.appName || PROFILE_PLACEHOLDER_NAME,
  };
  return state.profile;
}

function fillProfileForm() {
  const current = profile();
  els.profileSelect.innerHTML = profileStore.profiles
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(profileLabel(item))}</option>`)
    .join("");
  els.profileSelect.value = state.id;
  els.profileNameInput.value = current.profileName;
  els.themeSelect.value = appearance().theme;
}

function profileLabel(profileData) {
  return profileData.profile?.profileName || PROFILE_PLACEHOLDER_NAME;
}

function updateProfile() {
  state.profile = {
    profileName: els.profileNameInput.value.trim() || PROFILE_PLACEHOLDER_NAME,
  };
  saveState();
  fillProfileForm();
  render();
}

function switchProfile() {
  const selected = profileStore.profiles.find((item) => item.id === els.profileSelect.value);
  if (!selected) return;
  state = selected;
  profileStore.activeProfileId = state.id;
  fillSettingsForm();
  fillProfileForm();
  fillHistorySort();
  applyAppearance();
  els.monthlyShiftCount.value = state.business?.monthlyShiftCount ?? 20;
  syncAverageShiftIncomeField();
  els.flatExpenseRate.value = String(state.business?.flatExpenseRate ?? 0.8);
  els.sideIncomeToggle.checked = Boolean(state.business?.sideIncome);
  saveState();
  render();
}

function createProfile() {
  const profileNumber = profileStore.profiles.length + 1;
  const nextProfile = createDefaultProfile(`Profil ${profileNumber}`);
  profileStore.profiles.push(nextProfile);
  state = nextProfile;
  profileStore.activeProfileId = state.id;
  fillSettingsForm();
  fillProfileForm();
  fillHistorySort();
  applyAppearance();
  els.monthlyShiftCount.value = state.business.monthlyShiftCount;
  syncAverageShiftIncomeField();
  els.flatExpenseRate.value = String(state.business?.flatExpenseRate ?? 0.8);
  els.sideIncomeToggle.checked = Boolean(state.business?.sideIncome);
  saveState();
  render();
}

function deleteProfile() {
  if (!window.confirm("Smazat vybraný profil i jeho data?")) return;

  if (profileStore.profiles.length === 1) {
    const replacement = createDefaultProfile(PROFILE_PLACEHOLDER_NAME);
    profileStore.profiles = [replacement];
    state = replacement;
  } else {
    profileStore.profiles = profileStore.profiles.filter((item) => item.id !== state.id);
    state = profileStore.profiles[0];
  }

  profileStore.activeProfileId = state.id;
  fillSettingsForm();
  fillProfileForm();
  fillHistorySort();
  applyAppearance();
  els.monthlyShiftCount.value = state.business.monthlyShiftCount;
  syncAverageShiftIncomeField();
  els.flatExpenseRate.value = String(state.business?.flatExpenseRate ?? 0.8);
  els.sideIncomeToggle.checked = Boolean(state.business?.sideIncome);
  saveState();
  render();
}

function updateSettings(event) {
  const form = els.settingsForm.elements;
  const previousFuelType = state.settings.fuelType || "gasoline";
  const nextFuelType = form.fuelType.value || "gasoline";
  let fuelPrice = numberValue(form.fuelPrice.value);
  if (event?.target?.name === "fuelType" && nextFuelType !== previousFuelType) {
    const averagePrice = averageFuelPrice(nextFuelType);
    if (averagePrice > 0) {
      fuelPrice = averagePrice;
      form.fuelPrice.value = formatInputNumber(averagePrice, 2);
    }
  }
  state.settings = {
    consumption: numberValue(form.consumption.value),
    fuelPrice,
    vehicleRent: numberValue(form.vehicleRent.value),
    fuelType: nextFuelType,
    productionYear: numberValue(form.productionYear.value),
    amortizationMonthly: state.settings.amortizationMonthly || 0,
    fuelPrices: state.settings.fuelPrices || {
      gasoline: 0,
      diesel: 0,
      lpg: 0,
      updatedAt: "",
      source: FUEL_PRICE_SOURCE_NAME,
    },
    fixed: state.settings.fixed || { social: 0, health: 0, sickness: 0, pension: 0, tax: 0 },
  };
  form.amortizationMonthly.value = `${formatInputNumber(amortizationRatePerKm(), 2)} Kč / km`;
  renderFuelPriceMeta();
  saveState();
  render();
}

function appearance() {
  state.appearance = {
    theme: state.appearance?.theme === "dark" ? "dark" : "light",
    wallpaper: state.appearance?.wallpaper || "",
  };
  return state.appearance;
}

function updateAppearance() {
  const current = appearance();
  current.theme = els.themeSelect.value === "dark" ? "dark" : "light";
  saveState();
  applyAppearance();
}

async function updateWallpaper() {
  const file = els.wallpaperInput.files?.[0];
  if (!file) return;

  try {
    appearance().wallpaper = await imageFileToWallpaper(file);
    els.wallpaperInput.value = "";
    saveState();
    applyAppearance();
  } catch {
    els.wallpaperInput.value = "";
  }
}

function clearWallpaper() {
  appearance().wallpaper = "";
  els.wallpaperInput.value = "";
  saveState();
  applyAppearance();
}

function applyAppearance() {
  const current = appearance();
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const theme = current.theme === "system" ? (prefersDark ? "dark" : "light") : current.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty("--wallpaper", current.wallpaper ? `url("${current.wallpaper}")` : "none");
  document.body.classList.toggle("has-wallpaper", Boolean(current.wallpaper));
}

function imageFileToWallpaper(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Tapetu se nepovedlo načíst."));
    };
    image.src = url;
  });
}

function updateBusinessEstimate() {
  state.business = {
    ...(state.business || {}),
    monthlyShiftCount: numberValue(els.monthlyShiftCount.value),
    flatExpenseRate: parseFlatExpenseRate(els.flatExpenseRate.value),
    sideIncome: els.sideIncomeToggle.checked,
  };
  saveState();
  render();
}

function render() {
  applyAppearance();
  const currentProfile = profile();
  els.headerTitle.textContent = currentProfile.profileName;
  els.headerSubtitle.textContent = "Profil";
  document.title = "CourierNett";

  const month = els.monthPicker.value || toDateInput(new Date()).slice(0, 7);
  if (ensureOverview(month)) saveState();
  els.monthDisplayButton.textContent = formatShortMonthLabel(month);
  const monthShifts = state.shifts
    .filter((shift) => shift.date?.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  const visibleShifts = filterShiftsByService(monthShifts);
  const totals = calculateShiftTotals(visibleShifts);
  const profit = totals.income - totals.cost;

  els.metricIncome.textContent = formatMoney(totals.income);
  els.metricKm.textContent = formatKm(totals.km);
  els.metricFuel.textContent = formatMoney(totals.fuel + totals.amortization);
  els.metricTaxes.textContent = formatMoney(totals.taxes);
  els.metricRent.textContent = formatMoney(totals.rent);
  const hasVehicleRent = state.settings.vehicleRent > 0;
  els.metricRentTile.hidden = !hasVehicleRent;
  els.metricsGrid.classList.toggle("has-rent", hasVehicleRent);
  els.metricCosts.textContent = formatMoney(totals.cost);
  els.metricProfit.textContent = formatMoney(profit);
  els.metricHourly.textContent = totals.hours > 0 ? formatMoney(profit / totals.hours) : "Bez hodin";
  els.metricProfit.closest("article").classList.toggle("positive", profit >= 0);
  els.metricProfit.closest("article").classList.toggle("negative", profit < 0);
  els.metricHourly.closest("article").classList.toggle("positive", profit >= 0);
  els.metricHourly.closest("article").classList.toggle("negative", profit < 0);

  renderServiceFilter();
  els.overviewList.innerHTML = renderDashboardShiftTiles(visibleShifts);
  els.profitChart.innerHTML = renderProfitChart(visibleShifts);
  els.shiftList.innerHTML = renderOverviewHistoryCards(getOverviewMonths());
  renderTaxEstimate();
  bindDashboardShiftTiles();
  bindChartPoints();
  bindOverviewHistoryCards();
}

function renderTaxEstimate() {
  const averageIncome = syncAverageShiftIncomeField();
  const monthlyShiftCount = numberValue(els.monthlyShiftCount.value) || 0;
  const flatExpenseRate = parseFlatExpenseRate(state.business?.flatExpenseRate ?? els.flatExpenseRate.value);
  const sideIncome = Boolean(state.business?.sideIncome);
  els.flatExpenseRate.value = String(flatExpenseRate);
  els.sideIncomeToggle.checked = sideIncome;

  const estimate = calculateBusinessEstimate(averageIncome, monthlyShiftCount, flatExpenseRate, sideIncome);
  els.taxGrid.innerHTML = [
    ["Měsíční obrat", formatMoney(estimate.monthlyRevenue)],
    ["Roční obrat", formatMoney(estimate.annualRevenue)],
    ["Daň/měsíc", formatMoney(estimate.monthlyIncomeTax)],
    ["Sociální/měsíc", formatMoney(estimate.monthlySocialInsurance)],
    ["Zdravotní/měsíc", formatMoney(estimate.monthlyHealthInsurance)],
    ["Rezerva/měsíc", formatMoney(estimate.monthlyReserve)],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  els.taxStatus.textContent = sideIncome
    ? "Vedlejší příjem: zdravotní bez minima, sociální podle rozhodné částky. Orientační výpočet."
    : "Hlavní příjem: zdravotní a sociální s minimálními odvody. Orientační výpočet.";
}

function averageIncomePerShift() {
  const paidShifts = state.shifts.filter((shift) => shift.income > 0);
  if (!paidShifts.length) return 0;
  return paidShifts.reduce((sum, shift) => sum + shift.income, 0) / paidShifts.length;
}

function syncAverageShiftIncomeField() {
  const averageIncome = averageIncomePerShift();
  els.averageShiftIncome.value = averageIncome > 0 ? formatInputNumber(averageIncome, 2) : "";
  els.averageShiftIncome.placeholder = averageIncome > 0 ? "" : "Bez dat";
  return averageIncome;
}

function calculateBusinessEstimate(shiftIncome, monthlyShiftCount, flatExpenseRate = 0.8, sideIncome = false) {
  const monthlyRevenue = shiftIncome * monthlyShiftCount;
  const annualRevenue = monthlyRevenue * 12;
  const flatExpenses = Math.min(annualRevenue * flatExpenseRate, 1600000);
  const profitBase = Math.max(0, annualRevenue - flatExpenses);
  const incomeTax = calculateIncomeTax(profitBase);
  const socialInsurance = calculateSocialInsurance(profitBase, sideIncome);
  const healthInsurance = calculateHealthInsurance(profitBase, sideIncome);
  const monthlyIncomeTax = incomeTax / 12;
  const monthlySocialInsurance = socialInsurance / 12;
  const monthlyHealthInsurance = healthInsurance / 12;
  const monthlyReserve = monthlyIncomeTax + monthlySocialInsurance + monthlyHealthInsurance;

  return {
    monthlyRevenue,
    annualRevenue,
    flatExpenses,
    profitBase,
    incomeTax,
    socialInsurance,
    healthInsurance,
    monthlyIncomeTax,
    monthlySocialInsurance,
    monthlyHealthInsurance,
    monthlyReserve,
  };
}

function calculateSocialInsurance(profitBase, sideIncome) {
  const annualSocial = profitBase * 0.55 * 0.292;
  if (!sideIncome) return Math.max(annualSocial, 5720 * 12);
  const secondaryLimit = 117521;
  if (profitBase <= secondaryLimit) return 0;
  return Math.max(annualSocial, 1574 * 12);
}

function calculateHealthInsurance(profitBase, sideIncome) {
  const annualHealth = profitBase * 0.5 * 0.135;
  return sideIncome ? annualHealth : Math.max(annualHealth, 3306 * 12);
}

function calculateIncomeTax(taxBase) {
  const threshold = 48967 * 36;
  const lower = Math.min(taxBase, threshold) * 0.15;
  const higher = Math.max(0, taxBase - threshold) * 0.23;
  return lower + higher;
}

function renderShiftCards(shifts) {
  if (!shifts.length) return `<div class="empty">Žádné směny</div>`;

  return shifts
    .map((shift) => {
      const breakdown = getBreakdown(shift);
      const mapUrl = routeMapUrl(shift.routeStops || []);
      return `
        <article class="shift-card" data-id="${shift.id}">
          <div class="shift-top">
            <div>
              <h3>${escapeHtml(shift.title)}</h3>
              <p class="meta">${formatDate(shift.date)} · ${formatKm(shift.kilometers)} · ${formatHours(shift.hours)}</p>
            </div>
            <div class="profit">
              <strong>${formatMoney(shift.income)}</strong>
              <span class="meta">výdělek</span>
            </div>
          </div>
          ${mapUrl ? `<a class="map-link" href="${mapUrl}" target="_blank" rel="noopener">Mapa celého dne</a>` : ""}
          <div class="breakdown">
            <div><span>Příjem</span><strong>${formatMoney(shift.income)}</strong></div>
            <div><span>Náklady na km</span><strong>${formatMoney(breakdown.fuelCost + breakdown.amortizationShare)}</strong></div>
            <div><span>Kilometry</span><strong>${formatKm(shift.kilometers)}</strong></div>
            <div><span>Hodiny</span><strong>${formatHours(shift.hours)}</strong></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function createOverview() {
  const currentMonth = els.monthPicker.value || toDateInput(new Date()).slice(0, 7);
  ensureOverview(currentMonth);
  const month = nextAvailableMonthValue(currentMonth);
  ensureOverview(month);
  els.monthPicker.value = month;
  switchView("overview");
  saveState();
  render();
}

function ensureOverview(month) {
  state.overviews = Array.isArray(state.overviews) ? state.overviews : [];
  if (!state.overviews.some((item) => item.month === month)) {
    state.overviews.push({
      month,
      createdAt: new Date().toISOString(),
    });
    return true;
  }
  return false;
}

function getOverviewMonths() {
  const months = new Set((state.overviews || []).map((item) => item.month));
  state.shifts.forEach((shift) => {
    if (shift.date) months.add(shift.date.slice(0, 7));
  });
  const currentMonth = els.monthPicker.value || toDateInput(new Date()).slice(0, 7);
  months.add(currentMonth);
  const direction = state.preferences?.historySort === "asc" ? "asc" : "desc";
  return [...months].sort((a, b) => direction === "asc" ? a.localeCompare(b) : b.localeCompare(a));
}

function renderOverviewHistoryCards(months) {
  if (!months.length) return `<div class="empty">Žádné přehledy</div>`;

  return months.map((month) => {
    const totals = calculateMonthTotals(month);
    const profit = totals.income - totals.cost;
    return `
      <article class="overview-history-card" data-month="${month}">
        <div class="shift-top">
          <div>
            <h3>${formatMonthLabel(month)}</h3>
            <p class="meta">Kliknutím otevřeš přehled</p>
          </div>
          <div class="profit">
            <strong>${formatMoney(profit)}</strong>
            <span class="meta">zisk</span>
          </div>
        </div>
        <div class="breakdown">
          <div><span>Náklady/km</span><strong>${formatMoney(totals.fuel + totals.amortization)}</strong></div>
          <div><span>Kilometry</span><strong>${formatKm(totals.km)}</strong></div>
          <div><span>Hodiny</span><strong>${formatHours(totals.hours)}</strong></div>
          <div><span>Obrat</span><strong>${formatMoney(totals.income)}</strong></div>
        </div>
        <button class="delete-overview-button" data-month="${month}" type="button" aria-label="Smazat přehled ${formatMonthLabel(month)}" title="Smazat přehled">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16"></path>
            <path d="M9 7V5h6v2"></path>
            <path d="M7 7l1 13h8l1-13"></path>
            <path d="M10 11v5"></path>
            <path d="M14 11v5"></path>
          </svg>
        </button>
      </article>
    `;
  }).join("");
}

function bindOverviewHistoryCards() {
  document.querySelectorAll(".overview-history-card").forEach((card) => {
    card.addEventListener("click", () => {
      els.monthPicker.value = card.dataset.month;
      ensureOverview(card.dataset.month);
      switchView("overview");
      saveState();
      render();
    });
  });

  document.querySelectorAll(".delete-overview-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteOverview(button.dataset.month);
    });
  });
}

function deleteOverview(month) {
  if (!window.confirm(`Smazat přehled ${formatMonthLabel(month)} včetně jeho směn?`)) return;

  state.overviews = (state.overviews || []).filter((item) => item.month !== month);
  state.shifts = state.shifts.filter((shift) => !shift.date?.startsWith(month));
  if (els.monthPicker.value === month) {
    const nextMonth = getOverviewMonths().find((item) => item !== month) || toDateInput(new Date()).slice(0, 7);
    els.monthPicker.value = nextMonth;
    ensureOverview(nextMonth);
  }
  saveState();
  render();
}

function calculateMonthTotals(month) {
  return calculateShiftTotals(state.shifts.filter((shift) => shift.date?.startsWith(month)));
}

function calculateShiftTotals(shifts) {
  return shifts
    .reduce(
      (acc, shift) => {
        const breakdown = getBreakdown(shift);
        acc.km += shift.kilometers;
        acc.hours += shift.hours;
        acc.fuel += breakdown.fuelCost;
        acc.taxes += breakdown.osvcShare;
        acc.rent += breakdown.vehicleRentShare;
        acc.amortization += breakdown.amortizationShare;
        acc.cost += breakdown.totalCost;
        acc.income += shift.income;
        return acc;
      },
      { km: 0, hours: 0, fuel: 0, taxes: 0, rent: 0, amortization: 0, cost: 0, income: 0 }
    );
}

function filterShiftsByService(shifts) {
  return shifts.filter((shift) => selectedServices.has(normalizeServiceName(shift.title)));
}

function normalizeServiceName(value) {
  const service = SERVICE_OPTIONS.find((item) => item.toLowerCase() === String(value || "").trim().toLowerCase());
  return service || "Foodora";
}

function isServiceName(value) {
  return SERVICE_OPTIONS.includes(value);
}

function selectedImportService() {
  return document.querySelector('input[name="importService"]:checked')?.value || "";
}

function setServiceWarning(scope, visible) {
  scope?.classList.toggle("show-service-warning", Boolean(visible));
}

function renderServiceFilter() {
  if (!els.serviceFilter) return;
  const allSelected = selectedServices.size === SERVICE_OPTIONS.length;
  els.serviceFilter.innerHTML = [
    `<button class="service-chip${allSelected ? " active" : ""}" data-service="all" type="button">Vše</button>`,
    ...SERVICE_OPTIONS.map((service) => `
      <button class="service-chip${selectedServices.has(service) ? " active" : ""}" data-service="${service}" type="button">${service}</button>
    `),
  ].join("");

  els.serviceFilter.querySelectorAll(".service-chip").forEach((button) => {
    button.addEventListener("click", () => toggleServiceFilter(button.dataset.service));
  });
}

function toggleServiceFilter(service) {
  if (service === "all") {
    selectedServices = new Set(SERVICE_OPTIONS);
  } else if (selectedServices.size === SERVICE_OPTIONS.length) {
    selectedServices = new Set([service]);
  } else if (selectedServices.has(service) && selectedServices.size > 1) {
    selectedServices.delete(service);
  } else {
    selectedServices.add(service);
  }
  render();
}

function renderProfitChart(shifts) {
  const peakShift = findPeakShift(shifts);
  const lowShift = findLowShift(shifts);
  const points = shifts
    .filter((shift) => shift.hours > 0)
    .map((shift) => {
      return {
        id: shift.id,
        date: shift.date,
        value: Math.max(0, shift.income / shift.hours),
        isPeak: shift.id === peakShift?.id,
        isLow: shift.id === lowShift?.id,
      };
    });

  if (!points.length) return `<div class="empty chart-empty">Graf se zobrazí po doplnění výdělku a hodin.</div>`;

  const values = points.map((point) => point.value);
  const minValue = 0;
  const maxValue = Math.max(50, Math.ceil(Math.max(...values, 1) / 50) * 50);
  const range = maxValue - minValue || 1;
  const width = 680;
  const height = 240;
  const padding = { top: 18, right: 14, bottom: 38, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const yForValue = (value) => padding.top + ((maxValue - value) / range) * plotHeight;
  const chartPoints = points.map((point, index) => ({
    ...point,
    showValue: point.isPeak || point.isLow,
    showDate: true,
    x: padding.left + (points.length > 1 ? index * xStep : plotWidth / 2),
    y: yForValue(point.value),
  }));
  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const fillPath = `${linePath} L ${chartPoints.at(-1).x.toFixed(1)} ${padding.top + plotHeight} L ${chartPoints[0].x.toFixed(1)} ${padding.top + plotHeight} Z`;
  const tickCount = Math.floor(maxValue / 50) + 1;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const value = maxValue - (50 * index);
    return {
      value,
      y: yForValue(value),
    };
  });

  return `
    <div class="line-chart-scroll">
      <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Čistý zisk za hodinu podle směn">
        <defs>
          <linearGradient id="profitChartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.14"></stop>
            <stop offset="100%" stop-color="currentColor" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        ${ticks.map((tick) => `
          <line class="chart-grid" x1="${padding.left}" y1="${tick.y.toFixed(1)}" x2="${width - padding.right}" y2="${tick.y.toFixed(1)}"></line>
          ${tick.value % 100 === 0 ? `<text class="chart-y-label" x="${padding.left - 10}" y="${(tick.y + 4).toFixed(1)}">${formatAxisMoney(tick.value)}</text>` : ""}
        `).join("")}
        <line class="chart-axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotHeight}"></line>
        <line class="chart-axis" x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${width - padding.right}" y2="${padding.top + plotHeight}"></line>
        <path class="chart-area" d="${fillPath}"></path>
        <path class="chart-line" d="${linePath}"></path>
        ${chartPoints.map((point) => `
          <g class="chart-point-group${point.isPeak ? " is-peak" : ""}${point.isLow ? " is-low" : ""}">
            <circle class="chart-point" data-shift-id="${point.id}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4"></circle>
            ${point.isPeak ? `
              <circle class="chart-peak-ring" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="8"></circle>
            ` : ""}
            ${point.showValue ? `<text class="chart-value" x="${point.x.toFixed(1)}" y="${Math.max(12, point.y - 10).toFixed(1)}">${formatAxisMoney(point.value)}</text>` : ""}
            ${point.showDate ? `<text class="chart-date" x="${point.x.toFixed(1)}" y="${height - 22}" transform="rotate(-35 ${point.x.toFixed(1)} ${height - 22})">${formatWeekday(point.date)}</text>` : ""}
          </g>
        `).join("")}
      </svg>
    </div>
  `;
}

function findPeakShift(shifts) {
  return shifts.reduce((best, shift) => {
    if (!shift.hours) return best;
    const value = Math.max(0, shift.income / shift.hours);
    if (value <= 0) return best;
    if (!best || value > best.value) return { id: shift.id, date: shift.date, value };
    return best;
  }, null);
}

function findLowShift(shifts) {
  const validShifts = shifts.filter((shift) => shift.hours > 0);
  if (validShifts.length < 2) return null;

  return validShifts.reduce((lowest, shift) => {
    if (!shift.hours) return lowest;
    const value = Math.max(0, shift.income / shift.hours);
    if (!lowest || value < lowest.value) return { id: shift.id, date: shift.date, value };
    return lowest;
  }, null);
}

function exportCurrentOverviewPdf() {
  const month = els.monthPicker.value || toDateInput(new Date()).slice(0, 7);
  const monthShifts = state.shifts
    .filter((shift) => shift.date?.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date));
  const visibleShifts = filterShiftsByService(monthShifts);
  const totals = calculateShiftTotals(visibleShifts);
  const profit = totals.income - totals.cost;
  const html = buildOverviewPdfHtml(month, visibleShifts, totals, profit);
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    window.alert("Prohlížeč zablokoval otevření exportu. Povol vyskakovací okna a zkus Export PDF znovu.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
}

function buildOverviewPdfHtml(month, shifts, totals, profit) {
  const title = capitalizeFirst(formatMonthLabel(month));
  const totalCosts = [
    ["OSVČ", totals.taxes],
    ["Náklady na km", totals.fuel + totals.amortization],
    ["Pronájem", totals.rent],
  ].filter(([, value]) => value > 0);
  const rows = shifts.length
    ? shifts.map((shift) => {
      const breakdown = getBreakdown(shift);
      return `
        <tr>
          <td>${escapeHtml(formatDate(shift.date))}</td>
          <td>${escapeHtml(shift.title)}</td>
          <td class="num">${formatMoney(shift.income)}</td>
          <td class="num">${formatKm(shift.kilometers)}</td>
          <td class="num">${formatHours(shift.hours)}</td>
          <td class="num">${formatMoney(breakdown.profit)}</td>
        </tr>
      `;
    }).join("")
    : `<tr><td colspan="6">Žádné směny v tomto měsíci.</td></tr>`;

  return `<!doctype html>
    <html lang="cs">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)}</title>
        <style>
          body { margin: 28px; color: #111; font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          h1 { margin: 0 0 4px; font-size: 24px; }
          .meta { margin: 0 0 18px; color: #555; }
          .summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px; width: 50%; min-width: 360px; margin: 0 auto 18px; }
          .box { display: grid; align-content: center; justify-items: center; min-height: 46px; border: 1px solid #ddd; border-radius: 7px; padding: 6px 8px; text-align: center; }
          .box.profit { border-color: #b8d8c9; background: #f0f8f4; }
          .box.profit strong { color: #12633f; }
          .box.primary { grid-column: span 2; }
          .box.wide { grid-column: span 3; }
          .box span { display: block; color: #666; font-size: 10px; text-transform: uppercase; }
          .box strong { display: block; margin-top: 3px; font-size: 16px; line-height: 1.12; }
          .cost-lines { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 10px; margin-top: 5px; color: #555; font-size: 10px; }
          .cost-lines span { color: #555; font-size: 10px; text-transform: none; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
          th { font-size: 11px; text-transform: uppercase; color: #555; }
          .num { text-align: right; white-space: nowrap; }
          @media print { body { margin: 18mm; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p class="meta">${escapeHtml(profile().profileName)} · exportováno ${escapeHtml(formatDate(toDateInput(new Date())))}</p>
        <section class="summary">
          <div class="box primary profit"><span>Zisk</span><strong>${formatMoney(profit)}</strong></div>
          <div class="box primary"><span>Hodiny</span><strong>${formatHours(totals.hours)}</strong></div>
          <div class="box primary"><span>Kilometry</span><strong>${formatKm(totals.km)}</strong></div>
          <div class="box wide"><span>Obrat</span><strong>${formatMoney(totals.income)}</strong></div>
          <div class="box wide">
            <span>Náklady</span>
            <strong>${formatMoney(totals.cost)}</strong>
            <div class="cost-lines">
              ${totalCosts.length ? totalCosts.map(([label, value]) => `<span>${label}: ${formatMoney(value)}</span>`).join("") : "<span>Bez nákladů</span>"}
            </div>
          </div>
        </section>
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Směna</th>
              <th class="num">Obrat</th>
              <th class="num">Kilometry</th>
              <th class="num">Hodiny</th>
              <th class="num">Čistý zisk</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>`;
}

function renderDashboardShiftTiles(shifts) {
  const peakShift = findPeakShift(shifts);
  const lowShift = findLowShift(shifts);
  const addTile = `
    <button class="dashboard-shift dashboard-shift-add" id="dashboardAddShiftButton" type="button" aria-label="Nahrát data směny">
      <span>+</span>
    </button>
  `;
  if (!shifts.length) return `${addTile}<div class="empty">Žádné směny</div>`;

  return addTile + shifts
    .map((shift) => `
      <button class="dashboard-shift${shift.id === peakShift?.id ? " peak-shift" : ""}${shift.id === lowShift?.id ? " low-shift" : ""}" data-id="${shift.id}" type="button" title="${shift.id === peakShift?.id ? "Nejvyšší výkon měsíce" : shift.id === lowShift?.id ? "Nejnižší výkon měsíce" : ""}">
        <span>${formatShortDate(shift.date)}</span>
      </button>
    `)
    .join("");
}

function bindDashboardShiftTiles() {
  document.querySelector("#dashboardAddShiftButton")?.addEventListener("click", openShiftImport);

  document.querySelectorAll(".dashboard-shift").forEach((tile) => {
    if (!tile.dataset.id) return;
    tile.addEventListener("click", () => {
      const shift = state.shifts.find((item) => item.id === tile.dataset.id);
      if (shift) openShiftDetailDialog(shift);
    });
  });
}

function bindChartPoints() {
  document.querySelectorAll(".chart-point[data-shift-id]").forEach((point) => {
    point.addEventListener("click", () => {
      const shift = state.shifts.find((item) => item.id === point.dataset.shiftId);
      if (shift) openShiftDetailDialog(shift);
    });
  });
}

function openShiftImport() {
  switchView("import");
  setStatus(els.pdfStatus, "Vyber knihu jízd nebo výdělek podle toho, co chceš doplnit.");
}

function bindShiftCards() {
  document.querySelectorAll(".shift-card").forEach((card) => {
    card.addEventListener("click", () => {
      const shift = state.shifts.find((item) => item.id === card.dataset.id);
      if (shift) openShiftDialog(shift);
    });
  });

  document.querySelectorAll(".map-link").forEach((link) => {
    link.addEventListener("click", (event) => event.stopPropagation());
  });
}

function openShiftDetailDialog(shift) {
  const breakdown = getBreakdown(shift);
  const mapUrl = routeMapUrl(shift.routeStops || []);
  els.shiftDetailDialog.dataset.shiftId = shift.id;
  els.shiftDetailTitle.textContent = formatDate(shift.date);
  els.shiftDetailGrid.innerHTML = [
    ["Výdělek", formatMoney(shift.income)],
    ["Hodinový obrat", shift.hours > 0 ? formatMoney(shift.income / shift.hours) : "Bez hodin"],
    ["Kilometry", formatKm(shift.kilometers)],
    ["Hodiny", formatHours(shift.hours)],
    ["Náklady na km", formatMoney(breakdown.fuelCost + breakdown.amortizationShare)],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");

  els.shiftDetailMap.hidden = !mapUrl;
  if (mapUrl) els.shiftDetailMap.href = mapUrl;
  els.shiftDetailDialog.showModal();
}

function editShiftFromDetail() {
  const shift = state.shifts.find((item) => item.id === els.shiftDetailDialog.dataset.shiftId);
  if (!shift) return;
  els.shiftDetailDialog.close();
  openShiftDialog(shift);
}

function deleteShiftFromDetail() {
  const shift = state.shifts.find((item) => item.id === els.shiftDetailDialog.dataset.shiftId);
  if (!shift) return;
  if (!window.confirm(`Smazat směnu ${formatDate(shift.date)}?`)) return;
  state.shifts = state.shifts.filter((item) => item.id !== shift.id);
  saveState();
  render();
  els.shiftDetailDialog.close();
}

function getBreakdown(shift) {
  const fuelLiters = (shift.kilometers * state.settings.consumption) / 100;
  const fuelCost = fuelLiters * state.settings.fuelPrice;
  const osvcShare = osvcCostShare(shift);
  const vehicleRentShare = vehicleRentShareForShift(shift);
  const amortizationShare = amortizationShareForShift(shift);
  const totalCost = fuelCost + osvcShare + vehicleRentShare + amortizationShare;
  const profit = shift.income - totalCost;

  return {
    fuelLiters,
    fuelCost,
    osvcShare,
    vehicleRentShare,
    amortizationShare,
    osvcCostPerHour: shift.hours > 0 ? osvcShare / shift.hours : null,
    totalCost,
    profit,
    profitPerHour: shift.hours > 0 ? profit / shift.hours : null,
  };
}

function vehicleRentShareForShift(shift) {
  if (!shift.hours) return 0;
  const month = shift.date.slice(0, 7);
  const monthHours = totalHoursForMonth(month);
  if (!monthHours) return 0;
  return ((state.settings.vehicleRent || 0) / monthHours) * shift.hours;
}

function amortizationShareForShift(shift) {
  return (shift.kilometers || 0) * amortizationRatePerKm();
}

function amortizationRatePerKm() {
  return 2.0 * ageAmortizationCoefficient(state.settings.productionYear) * fuelAmortizationCoefficient(state.settings.fuelType);
}

function ageAmortizationCoefficient(year) {
  const value = Number(year) || 0;
  if (value >= 2020) return 1.2;
  if (value >= 2010) return 1.0;
  if (value >= 2000) return 1.3;
  return 1.6;
}

function fuelAmortizationCoefficient(fuelType) {
  if (fuelType === "diesel") return 1.4;
  if (fuelType === "lpg") return 1.15;
  return 1.0;
}

function averageFuelPrice(fuelType = state.settings.fuelType) {
  return Number(state.settings.fuelPrices?.[fuelType] || 0);
}

async function refreshFuelPriceIfOnline() {
  if (!navigator.onLine) {
    renderFuelPriceMeta();
    return;
  }
  try {
    const response = await fetch(FUEL_PRICE_PROXY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Cena paliva není dostupná.");
    const html = await response.text();
    const prices = parseFuelPrices(html);
    if (!prices) throw new Error("Ceny se nepovedlo přečíst.");
    state.settings.fuelPrices = {
      ...prices,
      updatedAt: new Date().toISOString(),
      source: FUEL_PRICE_SOURCE_NAME,
    };
    const price = averageFuelPrice();
    if (price > 0) {
      state.settings.fuelPrice = price;
      if (els.settingsForm) {
        els.settingsForm.elements.fuelPrice.value = formatInputNumber(price, 2);
      }
    }
    saveState();
    renderFuelPriceMeta();
    render();
  } catch {
    renderFuelPriceMeta();
  }
}

function parseFuelPrices(html) {
  const marker = "Aktuální průměrné ceny benzínu a nafty v ČR";
  const index = html.indexOf(marker);
  if (index < 0) return null;
  const normalized = html
    .slice(index)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const matches = normalized.match(/\d{1,3},\d{2}/g);
  if (!matches || matches.length < 3) return null;
  const values = matches.slice(0, 3).map((item) => numberValue(item));
  if (values.some((item) => item <= 0)) return null;
  return { gasoline: values[0], diesel: values[1], lpg: values[2] };
}

function renderFuelPriceMeta() {
  if (!els.fuelPriceMeta) return;
  const updatedAt = state.settings.fuelPrices?.updatedAt;
  const source = state.settings.fuelPrices?.source || FUEL_PRICE_SOURCE_NAME;
  els.fuelPriceMeta.textContent = updatedAt
    ? `Zdroj: ${source}, načteno ${formatDateTime(updatedAt)}`
    : `Zdroj: ${source}, zatím nenačteno`;
}

function osvcCostShare(shift) {
  if (!shift.hours) return 0;
  const month = shift.date.slice(0, 7);
  const monthHours = totalHoursForMonth(month);
  if (!monthHours) return 0;
  const estimate = calculateBusinessEstimate(
    averageIncomePerShift(),
    numberValue(els.monthlyShiftCount.value) || 0,
    parseFlatExpenseRate(state.business?.flatExpenseRate),
    Boolean(state.business?.sideIncome)
  );
  return (estimate.monthlyReserve / monthHours) * shift.hours;
}

function totalHoursForMonth(month) {
  return state.shifts
    .filter((shift) => shift.date?.startsWith(month))
    .reduce((sum, shift) => sum + (shift.hours || 0), 0);
}

function openShiftDialog(shift = null) {
  els.shiftDialogTitle.textContent = shift ? "Upravit směnu" : "Nová směna";
  els.deleteShiftButton.hidden = !shift;
  const form = els.shiftForm.elements;
  setServiceWarning(els.shiftForm.querySelector(".service-picker"), false);
  form.id.value = shift?.id || "";
  form.date.value = shift?.date || toDateInput(new Date());
  form.title.value = shift && isServiceName(shift.title) ? shift.title : "";
  form.kilometers.value = shift?.kilometers ?? 0;
  form.hours.value = shift?.hours ?? 0;
  form.income.value = shift?.income ?? 0;
  els.shiftDialog.showModal();
}

function saveShiftFromDialog(event) {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  const form = els.shiftForm.elements;
  if (!isServiceName(form.title.value)) {
    setServiceWarning(els.shiftForm.querySelector(".service-picker"), true);
    return;
  }
  const shift = {
    id: form.id.value || crypto.randomUUID(),
    date: form.date.value,
    title: form.title.value,
    kilometers: numberValue(form.kilometers.value),
    hours: numberValue(form.hours.value),
    income: numberValue(form.income.value),
    notes: state.shifts.find((item) => item.id === form.id.value)?.notes || "",
    routeStops: state.shifts.find((item) => item.id === form.id.value)?.routeStops || [],
  };
  const existingIndex = state.shifts.findIndex((item) => item.id === shift.id);
  if (existingIndex >= 0) state.shifts[existingIndex] = shift;
  else state.shifts.push(shift);
  saveState();
  render();
  els.shiftDialog.close();
}

function deleteSelectedShift() {
  const id = els.shiftForm.elements.id.value;
  state.shifts = state.shifts.filter((shift) => shift.id !== id);
  saveState();
  render();
  els.shiftDialog.close();
}

function saveImportData() {
  const service = selectedImportService();
  const warningScope = document.querySelector(".import-service-picker");
  if (!isServiceName(service)) {
    setServiceWarning(warningScope, true);
    setStatus(els.pdfStatus, "Nejdřív vyber službu.");
    setStatus(els.ocrStatus, "");
    return;
  }

  setServiceWarning(warningScope, false);
  const date = els.manualEarningsDate.value || els.manualPdfDate.value || toDateInput(new Date());
  const kilometers = numberValue(els.manualPdfKm.value);
  const income = numberValue(els.manualIncome.value);
  const hours = numberValue(els.manualHours.value);
  let saved = 0;

  if (pendingPdfImports.length) {
    pendingPdfImports.forEach((shift) => {
      upsertDailyShift(shift.date, { ...shift, title: service }, service, { skipRender: true });
      saved += 1;
    });
  } else if (kilometers > 0) {
    upsertDailyShift(els.manualPdfDate.value || date, { kilometers, title: service }, service, { skipRender: true });
    saved += 1;
  }

  if (income > 0) {
    applyDailyEarnings(date, income, hours || null, service, { skipRender: true });
    saved += 1;
  }

  if (!saved) {
    setStatus(els.pdfStatus, "Není co uložit.");
    setStatus(els.ocrStatus, "");
    return;
  }

  pendingPdfImports = [];
  els.manualPdfKm.value = "";
  els.manualIncome.value = "";
  els.manualHours.value = "";
  saveState();
  render();
  setStatus(els.pdfStatus, "Import uložen.");
  setStatus(els.ocrStatus, "");
}

async function handlePdfImport() {
  const file = els.pdfInput.files?.[0];
  if (!file) return;
  setStatus(els.pdfStatus, "Čtu PDF...");
  try {
    const data = await file.arrayBuffer();

    let imported = parseRideHistoryRows(await extractPdfPositionedText(data));

    if (!imported.length) {
      await ensureScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      let text = "";
      const positionedItems = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(" ") + "\n";
        positionedItems.push(...content.items.map((item) => ({
          text: item.str,
          x: item.transform?.[4] || 0,
          y: item.transform?.[5] || 0,
        })));
      }
      imported = parseRideHistoryRows(positionedItems);
      if (!imported.length) imported = parsePdfText(text);
    }

    if (!imported.length) throw new Error("Nenalezeny kilometry.");
    pendingPdfImports = imported;
    if (imported[0]) {
      els.manualPdfDate.value = imported[0].date;
      els.manualPdfKm.value = formatInputNumber(imported[0].kilometers, 1);
    }
    const trips = imported.reduce((sum, item) => sum + (item.tripCount || 1), 0);
    setStatus(els.pdfStatus, `Načteno: ${imported.length} den, ${trips} jízd, ${formatKm(imported.reduce((sum, item) => sum + item.kilometers, 0))}. Zkontroluj službu a klikni Uložit.`);
  } catch (error) {
    setStatus(els.pdfStatus, "PDF se nepovedlo přečíst. Zadej km ručně.");
  } finally {
    els.pdfInput.value = "";
  }
}

async function handleEarningsImport() {
  const file = els.earningsInput.files?.[0];
  if (!file) return;
  setStatus(els.ocrStatus, "Čtu screenshot...");
  try {
    await ensureScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
    const result = await Tesseract.recognize(file, "ces+eng");
    const text = result.data.text || "";
    const income = detectIncome(text);
    if (!income) throw new Error("Výdělek nenalezen.");
    const hours = detectHours(text);
    const detectedDate = detectDate(text);
    const date = detectedDate || els.manualEarningsDate.value || toDateInput(new Date());
    els.manualEarningsDate.value = date;
    els.manualIncome.value = formatInputNumber(income, 2);
    if (hours) els.manualHours.value = formatInputNumber(hours, 2);
    setStatus(els.ocrStatus, `Našla jsem: ${formatMoney(income)}${hours ? `, ${formatHours(hours)}` : ""}${detectedDate ? `, datum ${formatDate(date)}` : ""}. Zkontroluj službu a klikni Uložit.`);
  } catch (error) {
    setStatus(els.ocrStatus, "Screenshot se nepovedlo přečíst. Zadej výdělek ručně.");
  } finally {
    els.earningsInput.value = "";
  }
}

function parsePdfText(text) {
  const lines = text.split(/\n| {2,}/).map((line) => line.trim()).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const km = detectKilometers(line);
    const date = detectDate(line);
    if (km && date) parsed.push({ date, kilometers: km });
  }
  const total = detectKilometers(text);
  if (!parsed.length && total) parsed.push({ date: toDateInput(new Date()), kilometers: total });
  return parsed;
}

async function extractPdfPositionedText(arrayBuffer) {
  if (!("DecompressionStream" in window)) return [];

  const binary = bytesToBinary(new Uint8Array(arrayBuffer));
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const items = [];
  let match;

  while ((match = streamPattern.exec(binary))) {
    try {
      const rawBytes = binaryToBytes(match[1]);
      const inflated = await inflateBytes(rawBytes);
      const content = new TextDecoder("windows-1252").decode(inflated);
      items.push(...parsePdfDrawingText(content));
    } catch {
      // Some PDF streams may not be Flate-compressed text streams.
    }
  }

  return items;
}

function parsePdfDrawingText(content) {
  const items = [];
  const textPattern = /1 0 0 1\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm[\s\S]*?\(((?:\\.|[^\\)])*)\)Tj/g;
  let match;

  while ((match = textPattern.exec(content))) {
    items.push({
      text: decodePdfString(match[3]),
      x: Number(match[1]),
      y: Number(match[2]),
    });
  }

  return items;
}

async function inflateBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function bytesToBinary(bytes) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    output += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return output;
}

function binaryToBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function decodePdfString(text) {
  return text
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

function parseRideHistoryRows(items) {
  const rowStarts = items
    .filter((item) => item.x >= 35 && item.x <= 55 && item.text.toLowerCase().includes("slu"))
    .map((item) => item.y)
    .sort((a, b) => b - a);

  const trips = rowStarts.map((rowY) => {
    const startDate = cellText(items, rowY, 88, 144);
    const startTime = cellText(items, rowY - 8, 88, 144);
    const durationMinutes = numberFromText(cellText(items, rowY, 196, 252));
    const kilometers = numberFromText(cellText(items, rowY, 250, 306));
    const from = cleanAddress(cellBlockText(items, rowY, 308, 387));
    const to = cleanAddress(cellBlockText(items, rowY, 389, 468));
    const date = normalizeDate(startDate);

    if (!date || !kilometers) return null;
    return {
      date,
      kilometers,
      hours: durationMinutes ? durationMinutes / 60 : 0,
      startTime,
      from,
      to,
    };
  }).filter(Boolean);

  const byDate = new Map();
  for (const trip of trips) {
    const current = byDate.get(trip.date) || {
      date: trip.date,
      title: "Foodora",
      kilometers: 0,
      hours: 0,
      tripCount: 0,
      notes: "Import z PDF historie jízd",
      routeStops: [],
    };
    current.kilometers += trip.kilometers;
    current.hours += trip.hours;
    current.tripCount += 1;
    current.routeStops = appendRouteStops(current.routeStops, trip.from, trip.to);
    byDate.set(trip.date, current);
  }

  return [...byDate.values()].map((shift) => ({
    ...shift,
    kilometers: round(shift.kilometers, 1),
    hours: round(shift.hours, 2),
    notes: `Import z PDF historie jízd: ${shift.tripCount} jízd`,
  }));
}

function cellText(items, rowY, minX, maxX) {
  return items
    .filter((item) => Math.abs(item.y - rowY) <= 3 && item.x >= minX && item.x < maxX)
    .sort((a, b) => a.x - b.x)
    .map((item) => item.text)
    .join(" ")
    .trim();
}

function cellBlockText(items, rowY, minX, maxX) {
  return items
    .filter((item) => item.y <= rowY + 3 && item.y >= rowY - 24 && item.x >= minX && item.x < maxX)
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((item) => item.text)
    .join(" ")
    .trim();
}

function appendRouteStops(existing, from, to) {
  const stops = [...existing];
  [from, to].filter(Boolean).forEach((stop) => {
    if (stops[stops.length - 1] !== stop) stops.push(stop);
  });
  return stops;
}

function applyDailyEarnings(date, income, hours, service, options = {}) {
  if (!isServiceName(service)) return;
  const sameDay = state.shifts.filter((shift) => shift.date === date);
  if (!sameDay.length) {
    state.shifts.push({
      id: crypto.randomUUID(),
      date,
      title: service,
      kilometers: 0,
      hours: hours || 0,
      income,
      notes: "Vytvořeno z importu výdělku",
      routeStops: [],
    });
  } else {
    const totalKm = sameDay.reduce((sum, shift) => sum + shift.kilometers, 0);
    sameDay.forEach((shift) => {
      const share = totalKm > 0 ? shift.kilometers / totalKm : 1 / sameDay.length;
      shift.income = income * share;
      shift.title = service;
      if (hours) shift.hours = hours * share;
    });
  }
  if (!options.skipRender) {
    saveState();
    render();
  }
}

function upsertDailyShift(date, values, title, options = {}) {
  const service = isServiceName(values.title) ? values.title : title;
  if (!isServiceName(service)) return;
  let shift = state.shifts.find((item) => item.date === date);
  if (!shift) {
    shift = {
      id: crypto.randomUUID(),
      date,
      title: service,
      kilometers: 0,
      hours: 0,
      income: 0,
      notes: "",
      routeStops: [],
    };
    state.shifts.push(shift);
  }
  values.title = service;
  Object.assign(shift, values);
  if (!options.skipRender) {
    saveState();
    render();
  }
}

function detectKilometers(text) {
  const match = text.match(/(\d+(?:[,.]\d+)?)\s*km/i) || text.match(/km\s*:?\s*(\d+(?:[,.]\d+)?)/i);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function numberFromText(text) {
  const match = String(text).match(/(\d+(?:[,.]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function normalizeDate(text) {
  const match = String(text).match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (!match) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  return `${year}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
}

function cleanAddress(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\bCzechia\b/gi, "Cesko")
    .trim();
}

function routeMapUrl(stops) {
  const cleanStops = [...new Set((stops || []).map(cleanAddress).filter(Boolean))];
  if (cleanStops.length < 2) return "";

  const origin = cleanStops[0];
  const destination = cleanStops[cleanStops.length - 1];
  const waypoints = cleanStops.slice(1, -1).join("|");
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving",
  });
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function detectIncome(text) {
  const foodoraIncome = detectFoodoraIncome(text);
  if (foodoraIncome) return foodoraIncome;

  const scored = [...text.split(/\n/).flatMap((line, index, lines) => {
    const context = [lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" ");
    const numbers = [...line.matchAll(/(\d{1,6}(?:\s\d{3})*(?:\s*[,.]\s*\d{1,2})?)\s*(?:kc|kč|czk|czkč)?/gi)];
    return numbers.map((match) => {
      const lower = line.toLowerCase();
      const lowerContext = context.toLowerCase();
      let score = 0;
      const value = normalizeCurrencyValue(parseLocalizedNumber(match[1]));
      const hasCurrency = /kč|kc|czk/i.test(line);
      if (lowerContext.includes("výdělek") || lowerContext.includes("vydelek") || lowerContext.includes("earn")) score += 8;
      if (lowerContext.includes("zisk") || lowerContext.includes("příjem") || lowerContext.includes("prijem")) score += 6;
      if (lowerContext.includes("celkem") || lowerContext.includes("total") || lowerContext.includes("dnes")) score += 5;
      if (hasCurrency) score += 4;
      if (lower.includes("km")) score -= 5;
      if (lowerContext.includes("objedn") || lowerContext.includes("order") || lowerContext.includes("delivery")) score -= 4;
      if (lowerContext.includes("hod") || lowerContext.includes("hour") || lowerContext.includes("čas") || lowerContext.includes("cas")) score -= 3;
      if (!hasCurrency && score < 6) score -= 4;
      if (value > 20000) score -= 5;
      return { value, score };
    });
  })].filter((item) => item.value >= 50);
  scored.sort((a, b) => b.score - a.score || b.value - a.value);
  return scored[0]?.value || null;
}

function detectHours(text) {
  const foodoraHours = detectFoodoraHours(text);
  if (foodoraHours) return foodoraHours;

  const matches = [...text.matchAll(/(\d{1,2})\s*[:.]\s*([0-5]\d)\s*(?:h|hod|hours?)?/gi)];
  const decimal = [...text.matchAll(/(\d{1,2}(?:[,.]\d{1,2})?)\s*(?:h|hod|hodin|hours?)/gi)];
  const values = [
    ...matches.map((match) => Number(match[1]) + Number(match[2]) / 60),
    ...decimal.map((match) => Number(match[1].replace(",", "."))),
  ].filter((value) => value > 0 && value <= 24);
  return values[0] || null;
}

function detectDate(text) {
  const foodoraDate = detectFoodoraDate(text);
  if (foodoraDate) return foodoraDate;

  const match = text.match(/(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?/);
  if (!match) return null;
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : new Date().getFullYear();
  return `${year}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
}

function detectFoodoraIncome(text) {
  const compactText = text
    .replace(/(\d)\s+([,.])\s+(\d)/g, "$1$2$3")
    .replace(/(\d)\s+(?=\d{3}(?:[,.]\d{1,2})?\s*(?:kč|kc|czk))/gi, "$1");
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = [];

  lines.forEach((line, index) => {
    const context = [lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" ").toLowerCase();
    const amounts = [...line.matchAll(/(\d{1,6}(?:\s\d{3})*(?:\s*[,.]\s*\d{1,2})?)\s*(?:kč|kc|czk)/gi)];

    amounts.forEach((match) => {
      const value = normalizeCurrencyValue(parseLocalizedNumber(match[1]));
      let score = 0;
      if (context.includes("hodinov")) score -= 20;
      if (context.includes("průměr") || context.includes("prumer")) score -= 20;
      if (context.includes("zakázek") || context.includes("zakazek")) score += 8;
      if (context.match(/\b(po|ut|út|st|ct|čt|pa|pá|so|ne)\b/)) score += 8;
      if (value >= 500) score += 5;
      candidates.push({ value, score });
    });
  });

  if (!candidates.length) {
    const directAmounts = [...compactText.matchAll(/(\d{3,6}(?:[,.]\d{1,2})?)\s*(?:kč|kc|czk)/gi)]
      .map((match) => ({ value: normalizeCurrencyValue(parseLocalizedNumber(match[1])), score: 1 }));
    candidates.push(...directAmounts);
  }

  candidates.sort((a, b) => b.score - a.score || b.value - a.value);
  return candidates[0]?.value || null;
}

function detectFoodoraHours(text) {
  const match = text.match(/(\d{1,2})\s*h(?:odin(?:y)?)?\s*(\d{1,2})?\s*m?/i);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (hours <= 0 || hours > 24 || minutes > 59) return null;
  return hours + minutes / 60;
}

function detectFoodoraDate(text) {
  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = [];

  lines.forEach((line, index) => {
    const match = line.match(/\b(?:po|ut|út|st|ct|čt|pa|pá|so|ne)\s+(\d{1,2})[. ]+\s*(\d{1,2})\./i);
    if (!match) return;

    const context = [line, lines[index + 1], lines[index + 2]].filter(Boolean).join(" ").toLowerCase();
    let score = 0;
    if (context.includes("kč") || context.includes("kc")) score += 6;
    if (context.includes("zakázek") || context.includes("zakazek")) score += 6;
    if (line.includes("-")) score -= 8;
    candidates.push({ day: match[1], month: match[2], score });
  });

  candidates.sort((a, b) => b.score - a.score);
  const match = candidates[0];
  if (!match) return null;
  const year = new Date().getFullYear();
  return `${year}-${String(match.month).padStart(2, "0")}-${String(match.day).padStart(2, "0")}`;
}

function parseLocalizedNumber(value) {
  return Number(String(value).replace(/\s/g, "").replace(",", "."));
}

function normalizeCurrencyValue(value) {
  if (value >= 50000) return value / 100;
  return value;
}

function formatInputNumber(value, decimals = 2) {
  return round(value, decimals).toLocaleString("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: false,
  });
}

function ensureScript(src, module = false) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((script) => script.src === src)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    if (module) script.type = "module";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function exportData() {
  const backup = {
    app: "CourierNett",
    version: 1,
    exportedAt: new Date().toISOString(),
    store: profileStore,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileName = `zaloha-${slugify(profile().profileName)}-${toDateInput(new Date())}.json`;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  setStatus(els.backupStatus, `Záloha stažena: ${fileName}. Hledej ji ve složce Stažené/Downloads, případně tam, kam máš v prohlížeči nastavené ukládání. Zpět ji nahraješ v záložce Nastavení -> Záloha -> Nahrát zálohu.`);
}

async function importBackup() {
  const file = els.backupInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const restored = parseBackupStore(parsed);
    if (!window.confirm("Nahrát zálohu? Aktuální profily v tomto zařízení se přepíšou.")) {
      els.backupInput.value = "";
      return;
    }

    profileStore.profiles = restored.profiles;
    profileStore.activeProfileId = restored.activeProfileId;
    state = getActiveProfile();
    saveState();
    fillSettingsForm();
    fillProfileForm();
    els.monthlyShiftCount.value = state.business?.monthlyShiftCount ?? 20;
    syncAverageShiftIncomeField();
    els.flatExpenseRate.value = String(state.business?.flatExpenseRate ?? 0.8);
    els.sideIncomeToggle.checked = Boolean(state.business?.sideIncome);
    applyAppearance();
    render();
    setStatus(els.backupStatus, `Záloha nahrána: ${profileStore.profiles.length} profilů.`);
  } catch {
    setStatus(els.backupStatus, "Záloha se nepovedla načíst.");
  } finally {
    els.backupInput.value = "";
  }
}

function parseBackupStore(parsed) {
  if (parsed?.store?.profiles) return normalizeStore(parsed.store);
  if (parsed?.profiles) return normalizeStore(parsed);
  if (parsed?.shifts || parsed?.settings || parsed?.business) {
    const profileData = normalizeProfile(parsed, parsed.profile?.profileName || "Importovaný profil");
    return { activeProfileId: profileData.id, profiles: [profileData] };
  }
  throw new Error("Neplatná záloha.");
}

function backupHelpText() {
  return "Zálohy se po stažení ukládají do složky Stažené/Downloads, případně tam, kam máš v prohlížeči nastavené ukládání. Obnovíš je tady: Záloha -> Nahrát zálohu.";
}

function setStatus(element, text) {
  element.textContent = text;
}

function numberValue(value) {
  return Number(String(value || 0).replace(",", ".")) || 0;
}

function parseFlatExpenseRate(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return [0.8, 0.6, 0.4, 0.3].includes(parsed) ? parsed : 0.8;
}

function toDateInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function formatMoney(value) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatAxisMoney(value) {
  return new Intl.NumberFormat("cs-CZ", {
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatKm(value) {
  return `${(value || 0).toFixed(1)} km`;
}

function formatHours(value) {
  return value > 0 ? `${value.toFixed(2)} h` : "0 h";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(new Date(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMonthLabel(value) {
  const [year, month] = String(value).split("-").map(Number);
  return new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function formatShortMonthLabel(value) {
  const [year, month] = String(value).split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("cs-CZ", { month: "long" }).format(new Date(year, month - 1, 1));
  return `${capitalizeFirst(monthName)} ${String(year).slice(-2)}`;
}

function capitalizeFirst(value) {
  return value ? value.charAt(0).toLocaleUpperCase("cs-CZ") + value.slice(1) : "";
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric" }).format(new Date(value));
}

function formatWeekday(value) {
  return new Intl.DateTimeFormat("cs-CZ", { weekday: "short" })
    .format(new Date(value))
    .replace(".", "");
}

function nextMonthValue(value) {
  const [year, month] = String(value).split("-").map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function nextAvailableMonthValue(value) {
  let month = nextMonthValue(value);
  const existing = new Set(getOverviewMonths());
  while (existing.has(month)) month = nextMonthValue(month);
  return month;
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

function slugify(value) {
  return String(value || "export")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "export";
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}
