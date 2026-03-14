const STORAGE_KEY = "timesStateV1";
const surface = new URLSearchParams(window.location.search).get("surface") === "sidepanel"
  ? "sidepanel"
  : "popup";
document.documentElement.dataset.surface = surface;
document.body.dataset.surface = surface;
document.documentElement.dataset.theme = "light";
document.body.dataset.theme = "light";

const DEFAULT_CITIES = [
  { id: crypto.randomUUID(), label: "Local Time", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { id: crypto.randomUUID(), label: "Istanbul", timeZone: "Europe/Istanbul" },
  { id: crypto.randomUUID(), label: "Vienna", timeZone: "Europe/Vienna" },
  { id: crypto.randomUUID(), label: "Dublin", timeZone: "Europe/Dublin" }
];

const POPULAR_ZONES = [
  ["San Francisco", "America/Los_Angeles"],
  ["Los Angeles", "America/Los_Angeles"],
  ["New York", "America/New_York"],
  ["Chicago", "America/Chicago"],
  ["Denver", "America/Denver"],
  ["London", "Europe/London"],
  ["Dublin", "Europe/Dublin"],
  ["Vienna", "Europe/Vienna"],
  ["Istanbul", "Europe/Istanbul"],
  ["Kuala Lumpur", "Asia/Kuala_Lumpur"],
  ["Singapore", "Asia/Singapore"],
  ["Tokyo", "Asia/Tokyo"],
  ["Seoul", "Asia/Seoul"],
  ["Sydney", "Australia/Sydney"],
  ["Auckland", "Pacific/Auckland"],
  ["Dubai", "Asia/Dubai"],
  ["Berlin", "Europe/Berlin"],
  ["Paris", "Europe/Paris"],
  ["Amsterdam", "Europe/Amsterdam"],
  ["Madrid", "Europe/Madrid"],
  ["Lisbon", "Europe/Lisbon"],
  ["Warsaw", "Europe/Warsaw"],
  ["Toronto", "America/Toronto"],
  ["Vancouver", "America/Vancouver"],
  ["Mexico City", "America/Mexico_City"],
  ["Sao Paulo", "America/Sao_Paulo"],
  ["Johannesburg", "Africa/Johannesburg"],
  ["Cairo", "Africa/Cairo"],
  ["Mumbai", "Asia/Kolkata"],
  ["Hong Kong", "Asia/Hong_Kong"]
];

const cardsEl = document.querySelector("#cards");
const calendarViewEl = document.querySelector("#calendar-view");
const datalistEl = document.querySelector("#timezone-options");
const cardTemplate = document.querySelector("#card-template");
const headerAddButtonEl = document.querySelector("#header-add-button");
const addButtonWrapEl = document.querySelector(".add-button-wrap");
const calendarToggleButtonEl = document.querySelector("#calendar-toggle-button");
const headerResetButtonEl = document.querySelector("#header-reset-button");
const settingsButtonEl = document.querySelector("#settings-button");
const settingsPopoverEl = document.querySelector("#settings-popover");
const calendarDateEl = document.querySelector("#calendar-date");
const calendarHourEl = document.querySelector("#calendar-hour");
const calendarMinuteEl = document.querySelector("#calendar-minute");
const calendarPeriodEl = document.querySelector("#calendar-period");
const calendarTitleEl = document.querySelector("#calendar-title");
const calendarPreviewListEl = document.querySelector("#calendar-preview-list");
const calendarSubmitEl = document.querySelector("#calendar-submit");
const durationOptionsEl = document.querySelector("#duration-options");

const state = {
  cities: [],
  editingNameId: null,
  editingNameDraft: "",
  editingNameTouched: false,
  editingTimeId: null,
  editingTimeDraft: null,
  dragId: null,
  dragTargetId: null,
  addMode: false,
  addDraft: "",
  addTouched: false,
  activeView: "timezones",
  compareState: null,
  settingsOpen: false,
  focusTarget: null,
  calendar: {
    date: "",
    time: "",
    title: "",
    durationMinutes: 30,
    initializedForKey: ""
  },
  preferences: {
    timeFormat: "12h",
    pinFirstTimezone: true,
    openInSidePanel: false,
    darkMode: false
  }
};

function isFirstTimezonePinned() {
  return state.preferences.pinFirstTimezone !== false;
}

function isPinnedCity(cityId) {
  return isFirstTimezonePinned() && state.cities[0]?.id === cityId;
}

function applyTheme() {
  const theme = state.preferences.darkMode === true ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
}

const storage = {
  async get() {
    if (!globalThis.chrome?.storage?.local) {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    }
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || null;
  },
  async set(value) {
    if (!globalThis.chrome?.storage?.local) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      return;
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: value });
  }
};

function zoneLabel(zone) {
  return zone.split("/").at(-1).replace(/_/g, " ");
}

function titleCase(value) {
  return value
    .trim()
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function getAllSuggestions() {
  const seen = new Map();
  for (const [label, timeZone] of POPULAR_ZONES) {
    seen.set(`${label}||${timeZone}`, { label, timeZone });
  }

  const zones = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [];

  for (const timeZone of zones) {
    const label = zoneLabel(timeZone);
    seen.set(`${label}||${timeZone}`, { label, timeZone });
  }

  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
}

const suggestions = getAllSuggestions();

function fillDatalist() {
  const fragment = document.createDocumentFragment();
  for (const item of suggestions) {
    const option = document.createElement("option");
    option.value = item.label;
    option.label = item.timeZone;
    fragment.appendChild(option);
  }
  datalistEl.replaceChildren(fragment);
}

function normalizeQuery(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getNameSuggestions(query, limit = 6) {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return [];
  }

  return suggestions
    .map((item) => {
      const label = item.label.toLowerCase();
      const zone = item.timeZone.toLowerCase().replace(/_/g, " ");
      let rank = 99;
      let matchType = "";

      if (label === normalized) {
        rank = 0;
        matchType = "exact";
      } else if (label.startsWith(normalized)) {
        rank = 1;
        matchType = "city";
      } else if (label.includes(normalized)) {
        rank = 2;
        matchType = "city";
      } else if (zone.includes(normalized)) {
        rank = 3;
        matchType = "zone";
      }

      return rank === 99 ? null : { ...item, rank, matchType };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function getFormatter(timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

function getNumericFormatter(timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
}

function getParts(formatter, date) {
  return Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function formatParts(timeZone, referenceMs) {
  const sourceDate = new Date(referenceMs ?? Date.now());
  const displayParts = getParts(getFormatter(timeZone), sourceDate);
  const numericParts = getParts(getNumericFormatter(timeZone), sourceDate);
  const displayMinutes = Number(numericParts.hour) * 60 + Number(numericParts.minute);

  return {
    dateText: `${displayParts.weekday}, ${displayParts.month} ${displayParts.day}`,
    timeText: minutesToText(displayMinutes),
    minutes: displayMinutes,
    year: Number(numericParts.year),
    month: Number(numericParts.month),
    day: Number(numericParts.day)
  };
}

function getTimeZoneOffsetMinutes(timeZone, date) {
  const parts = getParts(getNumericFormatter(timeZone), date);
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUTC - date.getTime()) / 60000;
}

function zonedLocalToUtcMs(timeZone, year, month, day, totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let utcGuess = Date.UTC(year, month - 1, day, hours, minutes, 0);
  let offset = getTimeZoneOffsetMinutes(timeZone, new Date(utcGuess));
  utcGuess -= offset * 60000;

  const revisedOffset = getTimeZoneOffsetMinutes(timeZone, new Date(utcGuess));
  if (revisedOffset !== offset) {
    utcGuess -= (revisedOffset - offset) * 60000;
  }

  return utcGuess;
}

function getReferenceMs() {
  return state.compareState?.referenceMs ?? null;
}

function getCompareSourceId() {
  return state.compareState?.sourceId ?? null;
}

function isCompareSource(cityId) {
  return getCompareSourceId() === cityId;
}

function isActiveTimeSource(cityId) {
  return state.editingTimeId === cityId;
}

function sanitizeStoredCities(cities) {
  return cities.map((city) => ({
    id: city.id,
    label: city.label,
    timeZone: city.timeZone
  }));
}

function normalizeStoredState(stored) {
  if (!stored?.cities?.length) {
    return {
      cities: DEFAULT_CITIES,
      compareState: null,
      preferences: {
        timeFormat: "12h",
        pinFirstTimezone: true,
        openInSidePanel: false,
        darkMode: false
      }
    };
  }

  return {
    cities: sanitizeStoredCities(stored.cities),
    compareState: stored.compareState ?? null,
    preferences: {
      timeFormat: stored.preferences?.timeFormat === "24h" ? "24h" : "12h",
      pinFirstTimezone: stored.preferences?.pinFirstTimezone !== false,
      openInSidePanel: stored.preferences?.openInSidePanel === true,
      darkMode: stored.preferences?.darkMode === true
    }
  };
}

function getLiveDatePartsForCity(city) {
  return formatParts(city.timeZone, getReferenceMs());
}

function getBaseCalendarCity() {
  const compareSourceId = getCompareSourceId();
  return state.cities.find((city) => city.id === compareSourceId) || state.cities[0] || null;
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeInputValue(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getTimePartsFromMinutes(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;

  if (state.preferences.timeFormat === "24h") {
    return {
      hour: String(hours24).padStart(2, "0"),
      minute: String(minutes).padStart(2, "0"),
      period: ""
    };
  }

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return {
    hour: String(hours12).padStart(2, "0"),
    minute: String(minutes).padStart(2, "0"),
    period
  };
}

function parseDisplayTimeParts(hourValue, minuteValue, periodValue) {
  const rawHour = String(hourValue ?? "").replace(/\D/g, "");
  const rawMinute = String(minuteValue ?? "").replace(/\D/g, "");
  if (!rawHour || !rawMinute) {
    return null;
  }

  let hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (state.preferences.timeFormat === "24h") {
    if (hour < 0 || hour > 23) {
      return null;
    }
    return hour * 60 + minute;
  }

  if (hour < 1 || hour > 12) {
    return null;
  }

  hour %= 12;
  if ((periodValue || "AM") === "PM") {
    hour += 12;
  }
  return hour * 60 + minute;
}

function getCityEditingTimeDraft(city) {
  if (state.editingTimeDraft?.id === city.id) {
    return state.editingTimeDraft;
  }

  const parts = getTimePartsFromMinutes(getLiveDatePartsForCity(city).minutes);
  return {
    id: city.id,
    hour: parts.hour,
    minute: parts.minute,
    period: parts.period
  };
}

function parseTimeValue(value) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function getCalendarTimeParts() {
  const totalMinutes = parseTimeValue(state.calendar.time) ?? 0;
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;

  if (state.preferences.timeFormat === "24h") {
    return {
      hour: String(hours24).padStart(2, "0"),
      minute: String(minutes).padStart(2, "0"),
      period: ""
    };
  }

  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return {
    hour: String(hours12).padStart(2, "0"),
    minute: String(minutes).padStart(2, "0"),
    period
  };
}

function setCalendarTimeParts(nextHour, nextMinute, nextPeriod = "") {
  const rawHour = String(nextHour ?? "").replace(/\D/g, "");
  const rawMinute = String(nextMinute ?? "").replace(/\D/g, "");
  if (!rawHour || !rawMinute) {
    return;
  }

  let hour = Number(rawHour);
  const minute = Math.min(59, Math.max(0, Number(rawMinute)));

  if (state.preferences.timeFormat === "24h") {
    hour = Math.min(23, Math.max(0, hour));
    state.calendar.time = formatTimeInputValue(hour * 60 + minute);
    return;
  }

  hour = Math.min(12, Math.max(1, hour));
  let hours24 = hour % 12;
  if ((nextPeriod || "AM") === "PM") {
    hours24 += 12;
  }
  state.calendar.time = formatTimeInputValue(hours24 * 60 + minute);
}

function adjustCalendarTimeSegment(segment, direction) {
  const current = getCalendarTimeParts();

  if (segment === "hour") {
    if (state.preferences.timeFormat === "24h") {
      const nextHour = (Number(current.hour) + direction + 24) % 24;
      setCalendarTimeParts(nextHour, current.minute, current.period);
      return;
    }

    let nextHour = Number(current.hour) + direction;
    let nextPeriod = current.period;
    if (nextHour > 12) {
      nextHour = 1;
      nextPeriod = current.period === "AM" ? "PM" : "AM";
    } else if (nextHour < 1) {
      nextHour = 12;
      nextPeriod = current.period === "AM" ? "PM" : "AM";
    }
    setCalendarTimeParts(nextHour, current.minute, nextPeriod);
    return;
  }

  const nextMinute = (Number(current.minute) + direction + 60) % 60;
  setCalendarTimeParts(current.hour, nextMinute, current.period);
}

function formatCalendarLine(city, referenceMs) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: city.timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: state.preferences.timeFormat !== "24h"
  });
  return formatter.format(new Date(referenceMs));
}

function formatCalendarPreviewLine(city, referenceMs) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: city.timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: state.preferences.timeFormat !== "24h"
  });

  const parts = formatter.formatToParts(new Date(referenceMs));
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const timeValue = state.preferences.timeFormat === "24h"
    ? `${String(Number(values.hour)).padStart(2, "0")}:${values.minute}`
    : `${values.hour}:${values.minute} ${values.dayPeriod}`;

  return `${values.weekday}, ${values.month} ${values.day} · ${timeValue}`;
}

function ensureCalendarState(force = false) {
  const baseCity = getBaseCalendarCity();
  if (!baseCity) {
    return;
  }

  const referenceMs = getReferenceMs() ?? Date.now();
  const current = formatParts(baseCity.timeZone, referenceMs);
  const key = `${baseCity.id}:${current.year}-${current.month}-${current.day}:${current.minutes}`;
  if (!force && state.calendar.initializedForKey === key) {
    return;
  }

  const baseDate = new Date(Date.UTC(current.year, current.month - 1, current.day, 12, 0, 0));
  state.calendar.date = formatDateInputValue(baseDate);
  state.calendar.time = formatTimeInputValue(current.minutes);
  state.calendar.durationMinutes = state.calendar.durationMinutes || 30;
  state.calendar.initializedForKey = key;
}

function getCalendarDurationMinutes() {
  return state.calendar.durationMinutes || 30;
}

function getCalendarReferenceContext() {
  const baseCity = getBaseCalendarCity();
  if (!baseCity || !state.calendar.date || !state.calendar.time) {
    return null;
  }

  const [year, month, day] = state.calendar.date.split("-").map(Number);
  const totalMinutes = parseTimeValue(state.calendar.time);
  if (!year || !month || !day || totalMinutes === null) {
    return null;
  }

  const referenceMs = zonedLocalToUtcMs(baseCity.timeZone, year, month, day, totalMinutes);
  const durationMinutes = getCalendarDurationMinutes();

  return {
    baseCity,
    referenceMs,
    endReferenceMs: referenceMs + durationMinutes * 60 * 1000,
    durationMinutes
  };
}

function getCalendarEventUrl() {
  const context = getCalendarReferenceContext();
  if (!context) {
    return null;
  }

  const { baseCity, referenceMs, endReferenceMs } = context;
  const start = formatParts(baseCity.timeZone, referenceMs);
  const end = formatParts(baseCity.timeZone, endReferenceMs);
  const formatGoogleDate = (parts) => {
    const month = String(parts.month).padStart(2, "0");
    const day = String(parts.day).padStart(2, "0");
    const hours = String(Math.floor(parts.minutes / 60) % 24).padStart(2, "0");
    const minutes = String(parts.minutes % 60).padStart(2, "0");
    return `${parts.year}${month}${day}T${hours}${minutes}00`;
  };

  const detailsLines = [
    "",
    "---------------------------------------------",
    "Time across timezones:",
    "",
    ...state.cities.map((city) => `${city.label}: ${formatCalendarLine(city, referenceMs)}`),
    "",
    "Created with Asr World Clock",
    "---------------------------------------------"
  ];

  const params = new URLSearchParams({
    text: state.calendar.title.trim() || "Meeting from Asr World Clock",
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
    details: detailsLines.join("\n"),
    ctz: baseCity.timeZone
  });

  return `https://calendar.google.com/calendar/u/0/r/eventedit?${params.toString()}`;
}

function to24Hour(hourValue, minuteValue, dayPeriod) {
  let hour = Number(hourValue) % 12;
  if (dayPeriod?.toUpperCase() === "PM") {
    hour += 12;
  }
  if (dayPeriod?.toUpperCase() === "AM" && Number(hourValue) === 12) {
    hour = 0;
  }
  return hour * 60 + Number(minuteValue);
}

function minutesToText(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  if (state.preferences.timeFormat === "24h") {
    return `${String(hours24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

function parseTimeInput(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  const suffix = match[3]?.toUpperCase();

  if (minutes > 59) {
    return null;
  }

  if (suffix) {
    if (hours < 1 || hours > 12) {
      return null;
    }
    hours %= 12;
    if (suffix === "PM") {
      hours += 12;
    }
  } else if (hours > 23) {
    return null;
  }

  return (hours * 60 + minutes) % (24 * 60);
}

function getStatus(minutes) {
  const hour = Math.floor(minutes / 60);
  if (hour >= 6 && hour < 18) {
    return "sun";
  }
  if (hour >= 18 || hour < 6) {
    return "night";
  }
  return null;
}

function findSuggestion(value) {
  const normalized = normalizeQuery(value);
  if (!normalized) {
    return null;
  }

  const aliasMatch = POPULAR_ZONES.find(([label]) => label.toLowerCase() === normalized);
  if (aliasMatch) {
    return { label: titleCase(aliasMatch[0]), timeZone: aliasMatch[1] };
  }

  const exact = suggestions.find((item) => item.label.toLowerCase() === normalized);
  if (exact) {
    return { label: exact.label, timeZone: exact.timeZone };
  }

  const loose = suggestions.find((item) => {
    const haystack = `${item.label} ${item.timeZone}`.toLowerCase().replace(/_/g, " ");
    return haystack.includes(normalized);
  });

  return loose ? { label: titleCase(value), timeZone: loose.timeZone } : null;
}

async function persist() {
  await storage.set({
    cities: state.cities,
    compareState: state.compareState,
    preferences: state.preferences
  });
}

function focusAndSelect(selector, focusOptions = {}) {
  requestAnimationFrame(() => {
    const target = document.querySelector(selector);
    if (!target) {
      return;
    }
    target.focus();
    if (
      typeof target.setSelectionRange === "function" &&
      Number.isInteger(focusOptions.caretStart) &&
      Number.isInteger(focusOptions.caretEnd)
    ) {
      target.setSelectionRange(focusOptions.caretStart, focusOptions.caretEnd);
      return;
    }
    if (focusOptions.selectAll && typeof target.select === "function") {
      target.select();
    }
  });
}

async function initialize() {
  fillDatalist();
  const stored = await storage.get();
  const normalized = normalizeStoredState(stored);
  state.cities = normalized.cities;
  state.compareState = normalized.compareState;
  state.preferences = normalized.preferences;
  render();
  window.setInterval(() => {
    if (state.activeView === "calendar" || state.editingNameId || state.editingTimeId || state.addMode || state.dragId) {
      return;
    }
    render();
  }, 1000);
}

function renderCalendarView() {
  ensureCalendarState();

  calendarDateEl.value = state.calendar.date;
  const timeParts = getCalendarTimeParts();
  calendarHourEl.value = timeParts.hour;
  calendarMinuteEl.value = timeParts.minute;
  calendarPeriodEl.value = timeParts.period || "AM";
  calendarPeriodEl.classList.toggle("hidden", state.preferences.timeFormat === "24h");
  calendarTitleEl.value = state.calendar.title;

  durationOptionsEl.querySelectorAll('[data-role="duration-option"]').forEach((button) => {
    const isActive = Number(button.dataset.minutes) === state.calendar.durationMinutes;
    button.classList.toggle("is-active", isActive);
  });

  const context = getCalendarReferenceContext();
  const fragment = document.createDocumentFragment();
  if (context) {
    for (const city of state.cities) {
      const row = document.createElement("div");
      row.className = "calendar-preview-row";

      const cityLabel = document.createElement("span");
      cityLabel.className = "calendar-preview-city";
      cityLabel.textContent = city.label;

      const timeLabel = document.createElement("span");
      timeLabel.className = "calendar-preview-time";
      timeLabel.textContent = formatCalendarPreviewLine(city, context.referenceMs);

      row.append(cityLabel, timeLabel);
      fragment.appendChild(row);
    }
  } else {
    const empty = document.createElement("div");
    empty.className = "name-suggestion-empty";
    empty.textContent = "Pick a date and time to preview the event.";
    fragment.appendChild(empty);
  }
  calendarPreviewListEl.replaceChildren(fragment);
}

function render() {
  applyTheme();
  const isCalendarView = state.activeView === "calendar";
  cardsEl.classList.toggle("hidden", isCalendarView);
  calendarViewEl.classList.toggle("hidden", !isCalendarView);
  addButtonWrapEl.classList.toggle("hidden", isCalendarView);
  calendarToggleButtonEl.classList.toggle("is-active", isCalendarView);
  headerResetButtonEl.classList.toggle("hidden", !state.compareState);
  settingsPopoverEl.classList.toggle("hidden", !state.settingsOpen);
  settingsPopoverEl.querySelectorAll('[data-role="time-format"]').forEach((button) => {
    button.classList.toggle("is-active", button.dataset.format === state.preferences.timeFormat);
  });
  const pinFirstTimezoneButton = settingsPopoverEl.querySelector('[data-role="pin-first-timezone"]');
  pinFirstTimezoneButton?.classList.toggle("is-active", isFirstTimezonePinned());
  pinFirstTimezoneButton?.setAttribute("aria-pressed", isFirstTimezonePinned() ? "true" : "false");
  const openInSidePanelButton = settingsPopoverEl.querySelector('[data-role="open-in-side-panel"]');
  openInSidePanelButton?.classList.toggle("is-active", state.preferences.openInSidePanel === true);
  openInSidePanelButton?.setAttribute("aria-pressed", state.preferences.openInSidePanel === true ? "true" : "false");
  const darkModeButton = settingsPopoverEl.querySelector('[data-role="dark-mode"]');
  darkModeButton?.classList.toggle("is-active", state.preferences.darkMode === true);
  darkModeButton?.setAttribute("aria-pressed", state.preferences.darkMode === true ? "true" : "false");

  if (isCalendarView) {
    renderCalendarView();
    cardsEl.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const city of state.cities) {
    const node = cardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = city.id;
    node.draggable = !isPinnedCity(city.id);
    node.classList.toggle("is-overridden", isActiveTimeSource(city.id));
    node.classList.toggle("is-pinned", isPinnedCity(city.id));
    node.classList.toggle("is-dragging", state.dragId === city.id);
    node.classList.toggle("is-drag-target", state.dragTargetId === city.id);

    const nameHost = node.querySelector(".card-title-block");
    const timeHost = node.querySelector(".card-time-block");
    const editZoneEl = node.querySelector(".card-edit-zone");
    const dateEl = node.querySelector(".card-date");
    const metaEl = node.querySelector(".card-meta");

    const { dateText, timeText, minutes } = getLiveDatePartsForCity(city);
    dateEl.textContent = dateText;
    metaEl.classList.toggle("is-editing", state.editingNameId === city.id);

    if (state.editingNameId === city.id) {
      const searchShell = document.createElement("div");
      searchShell.className = "name-search-shell";
      const input = document.createElement("input");
      input.className = "inline-input name-input";
      input.type = "text";
      input.value = state.editingNameDraft;
      input.dataset.role = "name-input";
      input.dataset.id = city.id;
      input.autocomplete = "off";
      input.placeholder = "Search city or timezone";
      searchShell.appendChild(input);
      nameHost.replaceChildren(searchShell);

      if (state.editingNameTouched && normalizeQuery(state.editingNameDraft)) {
        const results = getNameSuggestions(state.editingNameDraft);
        const list = document.createElement("div");
        list.className = "name-suggestion-list";

        if (results.length) {
          for (const result of results) {
            const option = document.createElement("button");
            option.type = "button";
            option.className = "name-suggestion-item";
            option.dataset.role = "name-suggestion";
            option.dataset.id = city.id;
            option.dataset.label = result.label;
            option.dataset.timeZone = result.timeZone;

            const copy = document.createElement("span");
            copy.className = "name-suggestion-copy";

            const label = document.createElement("span");
            label.className = "name-suggestion-label";
            label.textContent = result.label;

            const zone = document.createElement("span");
            zone.className = "name-suggestion-zone";
            zone.textContent = result.timeZone;

            const match = document.createElement("span");
            match.className = "name-suggestion-match";
            match.textContent = result.matchType;

            copy.append(label, zone);
            option.append(copy, match);
            list.appendChild(option);
          }
        } else {
          const empty = document.createElement("div");
          empty.className = "name-suggestion-empty";
          empty.textContent = "No matching time zones";
          list.appendChild(empty);
        }

        editZoneEl.appendChild(list);
      }
    } else {
      const button = document.createElement("button");
      button.className = "card-name";
      button.type = "button";
      button.dataset.role = "name-button";
      button.dataset.id = city.id;
      const label = document.createElement("span");
      label.className = "card-title-label";
      label.textContent = city.label;
      button.appendChild(label);
      if (isPinnedCity(city.id)) {
        const pin = document.createElement("span");
        pin.className = "card-pin";
        pin.textContent = "📍";
        pin.ariaHidden = "true";
        button.appendChild(pin);
      }
      nameHost.replaceChildren(button);
    }

    if (state.editingTimeId === city.id) {
      const draft = getCityEditingTimeDraft(city);
      const editor = document.createElement("div");
      editor.className = "card-time-editor";
      editor.dataset.id = city.id;

      const hourInput = document.createElement("input");
      hourInput.className = "card-time-segment";
      hourInput.type = "text";
      hourInput.value = draft.hour;
      hourInput.dataset.role = "time-hour";
      hourInput.dataset.id = city.id;
      hourInput.inputMode = "numeric";
      hourInput.maxLength = 2;
      hourInput.autocomplete = "off";

      const separator = document.createElement("span");
      separator.className = "card-time-separator";
      separator.textContent = ":";

      const minuteInput = document.createElement("input");
      minuteInput.className = "card-time-segment";
      minuteInput.type = "text";
      minuteInput.value = draft.minute;
      minuteInput.dataset.role = "time-minute";
      minuteInput.dataset.id = city.id;
      minuteInput.inputMode = "numeric";
      minuteInput.maxLength = 2;
      minuteInput.autocomplete = "off";

      editor.append(hourInput, separator, minuteInput);

      if (state.preferences.timeFormat !== "24h") {
        const periodSelect = document.createElement("select");
        periodSelect.className = "card-time-period";
        periodSelect.dataset.role = "time-period";
        periodSelect.dataset.id = city.id;
        for (const period of ["AM", "PM"]) {
          const option = document.createElement("option");
          option.value = period;
          option.textContent = period;
          option.selected = draft.period === period;
          periodSelect.appendChild(option);
        }
        editor.appendChild(periodSelect);
      }

      timeHost.replaceChildren(editor);
    } else {
      const button = document.createElement("button");
      button.className = "card-time";
      button.type = "button";
      button.textContent = timeText;
      button.dataset.role = "time-button";
      button.dataset.id = city.id;
      timeHost.replaceChildren(button);
    }

    if (state.editingNameId === city.id) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "remove-city-button";
      removeButton.textContent = "Remove city";
      removeButton.dataset.role = "remove-city";
      removeButton.dataset.id = city.id;
      metaEl.appendChild(removeButton);
    } else {
      const status = getStatus(minutes);
      if (status) {
        const pill = document.createElement("span");
        pill.className = `meta-pill is-${status}`;
        pill.title = status === "sun" ? "Daylight" : "Night";
        metaEl.appendChild(pill);
      }
    }

    node.addEventListener("dragstart", handleDragStart);
    node.addEventListener("dragover", handleDragOver);
    node.addEventListener("drop", handleDrop);
    node.addEventListener("dragend", handleDragEnd);

    fragment.appendChild(node);
  }

  if (state.addMode) {
    fragment.appendChild(renderAddCard());
  }
  cardsEl.replaceChildren(fragment);

  if (state.focusTarget?.type === "name" && state.editingNameId === state.focusTarget.id) {
    focusAndSelect(
      `input[data-role="name-input"][data-id="${state.editingNameId}"]`,
      state.focusTarget
    );
    state.focusTarget = null;
  }
  if (state.focusTarget?.type === "time-segment" && state.editingTimeId === state.focusTarget.id) {
    focusAndSelect(
      `[data-role="${state.focusTarget.segment}"][data-id="${state.editingTimeId}"]`,
      state.focusTarget
    );
    state.focusTarget = null;
  }
  if (state.focusTarget?.type === "add" && state.addMode) {
    focusAndSelect('input[data-role="add-input"]', state.focusTarget);
    state.focusTarget = null;
  }
}

function renderAddCard() {
  const wrapper = document.createElement("div");
  const card = document.createElement("article");
  card.className = "city-card add-card";
  const form = document.createElement("form");
  form.className = "add-form";
  form.dataset.role = "add-form";

  const searchShell = document.createElement("div");
  searchShell.className = "name-search-shell";
  const input = document.createElement("input");
  input.className = "add-input";
  input.type = "text";
  input.placeholder = "Search city or timezone";
  input.dataset.role = "add-input";
  input.value = state.addDraft;
  input.autocomplete = "off";
  searchShell.appendChild(input);

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "reset-button";
  cancel.textContent = "Cancel";
  cancel.dataset.role = "cancel-add";

  form.append(searchShell, cancel);
  card.append(form);

  if (state.addTouched && normalizeQuery(state.addDraft)) {
    const results = getNameSuggestions(state.addDraft);
    const list = document.createElement("div");
    list.className = "name-suggestion-list";

    if (results.length) {
      for (const result of results) {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "name-suggestion-item";
        option.dataset.role = "add-suggestion";
        option.dataset.label = result.label;
        option.dataset.timeZone = result.timeZone;

        const copy = document.createElement("span");
        copy.className = "name-suggestion-copy";

        const label = document.createElement("span");
        label.className = "name-suggestion-label";
        label.textContent = result.label;

        const zone = document.createElement("span");
        zone.className = "name-suggestion-zone";
        zone.textContent = result.timeZone;

        const match = document.createElement("span");
        match.className = "name-suggestion-match";
        match.textContent = result.matchType;

        copy.append(label, zone);
        option.append(copy, match);
        list.appendChild(option);
      }
    } else {
      const empty = document.createElement("div");
      empty.className = "name-suggestion-empty";
      empty.textContent = "No matching time zones";
      list.appendChild(empty);
    }

    card.append(list);
  }

  wrapper.append(card);
  return wrapper;
}

function handleDragStart(event) {
  const card = event.currentTarget;
  if (isPinnedCity(card.dataset.id)) {
    event.preventDefault();
    return;
  }
  const role = event.target?.dataset?.role;
  if (role?.includes("button") || role?.includes("input")) {
    event.preventDefault();
    return;
  }
  state.dragId = card.dataset.id;
  state.dragTargetId = null;
  event.dataTransfer.setData("text/plain", state.dragId);
  event.dataTransfer.effectAllowed = "move";
  card.classList.add("is-dragging");
}

function handleDragOver(event) {
  const targetId = event.currentTarget.dataset.id;
  if (isFirstTimezonePinned() && state.cities[0]?.id === targetId) {
    return;
  }
  event.preventDefault();
  if (!state.dragId || targetId === state.dragId || state.dragTargetId === targetId) {
    return;
  }
  state.dragTargetId = targetId;
  document.querySelectorAll(".city-card.is-drag-target").forEach((element) => {
    element.classList.remove("is-drag-target");
  });
  event.currentTarget.classList.add("is-drag-target");
}

async function handleDrop(event) {
  const targetId = event.currentTarget.dataset.id;
  if (isFirstTimezonePinned() && state.cities[0]?.id === targetId) {
    resetDragState();
    clearDragClasses();
    render();
    return;
  }
  event.preventDefault();
  if (!state.dragId || state.dragId === targetId) {
    resetDragState();
    clearDragClasses();
    render();
    return;
  }

  const fromIndex = state.cities.findIndex((item) => item.id === state.dragId);
  const toIndex = state.cities.findIndex((item) => item.id === targetId);
  const [moved] = state.cities.splice(fromIndex, 1);
  state.cities.splice(toIndex, 0, moved);
  resetDragState();
  clearDragClasses();
  await persist();
  render();
}

function handleDragEnd() {
  resetDragState();
  clearDragClasses();
  render();
}

function resetDragState() {
  state.dragId = null;
  state.dragTargetId = null;
}

function clearDragClasses() {
  document.querySelectorAll(".city-card.is-dragging").forEach((element) => {
    element.classList.remove("is-dragging");
  });
  document.querySelectorAll(".city-card.is-drag-target").forEach((element) => {
    element.classList.remove("is-drag-target");
  });
}

async function commitNameEdit(id, value) {
  const city = state.cities.find((item) => item.id === id);
  if (!city) {
    return;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    state.editingNameId = null;
    state.editingNameDraft = "";
    state.editingNameTouched = false;
    render();
    return;
  }

  const suggestion = findSuggestion(trimmed);
  if (suggestion) {
    city.label = suggestion.label;
    city.timeZone = suggestion.timeZone;
  } else {
    city.label = titleCase(trimmed);
  }

  state.editingNameId = null;
  state.editingNameDraft = "";
  state.editingNameTouched = false;
  await persist();
  render();
}

async function applyNameSuggestion(id, label, timeZone) {
  const city = state.cities.find((item) => item.id === id);
  if (!city) {
    return;
  }

  city.label = label;
  city.timeZone = timeZone;
  state.editingNameId = null;
  state.editingNameDraft = "";
  state.editingNameTouched = false;
  await persist();
  render();
}

async function setReferenceTimeFromCity(id, totalMinutes) {
  const city = state.cities.find((item) => item.id === id);
  if (!city) {
    return;
  }

  const currentParts = getLiveDatePartsForCity(city);
  state.compareState = {
    sourceId: city.id,
    referenceMs: zonedLocalToUtcMs(
      city.timeZone,
      currentParts.year,
      currentParts.month,
      currentParts.day,
      totalMinutes
    )
  };
  await persist();
}

async function commitTimeEdit(id) {
  if (state.editingTimeDraft?.id !== id) {
    state.editingTimeId = null;
    render();
    return;
  }

  const parsed = parseDisplayTimeParts(
    state.editingTimeDraft.hour,
    state.editingTimeDraft.minute,
    state.editingTimeDraft.period
  );
  state.editingTimeId = null;
  state.editingTimeDraft = null;

  if (parsed === null) {
    render();
    return;
  }

  await setReferenceTimeFromCity(id, parsed);
  render();
}

async function addCity(value) {
  const suggestion = findSuggestion(value);
  if (!suggestion) {
    render();
    return;
  }

  state.cities.push({
    id: crypto.randomUUID(),
    label: suggestion.label,
    timeZone: suggestion.timeZone
  });
  state.addMode = false;
  state.addDraft = "";
  state.addTouched = false;
  await persist();
  render();
}

async function addCitySuggestion(label, timeZone) {
  state.cities.push({
    id: crypto.randomUUID(),
    label,
    timeZone
  });
  state.addMode = false;
  state.addDraft = "";
  state.addTouched = false;
  await persist();
  render();
}

async function syncEditingTimeDraft(id) {
  if (state.editingTimeDraft?.id !== id) {
    return;
  }

  const parsed = parseDisplayTimeParts(
    state.editingTimeDraft.hour,
    state.editingTimeDraft.minute,
    state.editingTimeDraft.period
  );
  if (parsed === null) {
    return;
  }

  await setReferenceTimeFromCity(id, parsed);
}

function adjustEditingTimeDraftSegment(id, segment, direction) {
  if (state.editingTimeDraft?.id !== id) {
    return;
  }

  if (segment === "time-hour") {
    if (state.preferences.timeFormat === "24h") {
      const nextHour = (Number(state.editingTimeDraft.hour || "0") + direction + 24) % 24;
      state.editingTimeDraft.hour = String(nextHour).padStart(2, "0");
      return;
    }

    let nextHour = Number(state.editingTimeDraft.hour || "12") + direction;
    let nextPeriod = state.editingTimeDraft.period || "AM";
    if (nextHour > 12) {
      nextHour = 1;
      nextPeriod = nextPeriod === "AM" ? "PM" : "AM";
    } else if (nextHour < 1) {
      nextHour = 12;
      nextPeriod = nextPeriod === "AM" ? "PM" : "AM";
    }
    state.editingTimeDraft.hour = String(nextHour).padStart(2, "0");
    state.editingTimeDraft.period = nextPeriod;
    return;
  }

  const nextMinute = (Number(state.editingTimeDraft.minute || "0") + direction + 60) % 60;
  state.editingTimeDraft.minute = String(nextMinute).padStart(2, "0");
}

async function removeCity(id) {
  const index = state.cities.findIndex((item) => item.id === id);
  if (index === -1) {
    return;
  }

  state.cities.splice(index, 1);

  if (state.compareState?.sourceId === id) {
    state.compareState = null;
  }

  if (state.editingNameId === id) {
    state.editingNameId = null;
    state.editingNameDraft = "";
    state.editingNameTouched = false;
  }

  if (state.editingTimeId === id) {
    state.editingTimeId = null;
    state.editingTimeDraft = null;
  }

  await persist();
  render();
}

cardsEl.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-role]");
  const role = action?.dataset?.role;
  const id = action?.dataset?.id;

  if (role === "name-button") {
    state.editingNameId = id;
    state.editingNameDraft = state.cities.find((item) => item.id === id)?.label || "";
    state.editingNameTouched = false;
    state.editingTimeId = null;
    state.editingTimeDraft = null;
    state.focusTarget = {
      type: "name",
      id,
      selectAll: true
    };
    render();
    return;
  }

  if (role === "time-button") {
    const city = state.cities.find((item) => item.id === id);
    if (!city) {
      return;
    }
    state.editingTimeId = id;
    state.editingTimeDraft = getCityEditingTimeDraft(city);
    state.editingNameId = null;
    state.editingNameDraft = "";
    state.editingNameTouched = false;
    state.focusTarget = {
      type: "time-segment",
      id,
      segment: "time-hour",
      selectAll: true
    };
    render();
    return;
  }

  if (role === "remove-city") {
    await removeCity(id);
    return;
  }

  if (role === "cancel-add") {
    state.addMode = false;
    state.addDraft = "";
    state.addTouched = false;
    render();
  }
});

cardsEl.addEventListener("keydown", async (event) => {
  const role = event.target?.dataset?.role;
  const id = event.target?.dataset?.id;

  if (event.key === "Escape") {
    state.editingNameId = null;
    state.editingNameDraft = "";
    state.editingNameTouched = false;
    state.editingTimeId = null;
    state.editingTimeDraft = null;
    state.addMode = false;
    state.addDraft = "";
    state.addTouched = false;
    state.settingsOpen = false;
    state.focusTarget = null;
    render();
    return;
  }

  if (event.key !== "Enter") {
    return;
  }

  if (role === "name-input") {
    event.preventDefault();
    await commitNameEdit(id, event.target.value);
  }

  if (role === "time-hour" || role === "time-minute" || role === "time-period") {
    event.preventDefault();
    await commitTimeEdit(id);
  }

  if (role === "add-input") {
    event.preventDefault();
    await addCity(event.target.value);
  }
});

cardsEl.addEventListener("focusout", async (event) => {
  const role = event.target?.dataset?.role;
  const id = event.target?.dataset?.id;
  if (role === "name-input") {
    const value = event.target.value;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(async () => {
        const activeRole = document.activeElement?.dataset?.role;
        const activeId = document.activeElement?.dataset?.id;
        if (activeRole === "name-input" && activeId === id) {
          return;
        }
        if (state.editingNameId !== id) {
          return;
        }
        await commitNameEdit(id, value);
      });
    });
    return;
  }
  if (role === "time-hour" || role === "time-minute" || role === "time-period") {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(async () => {
        const activeRole = document.activeElement?.dataset?.role;
        const activeId = document.activeElement?.dataset?.id;
        const stillInTimeEditor = (
          (activeRole === "time-hour" || activeRole === "time-minute" || activeRole === "time-period") &&
          activeId === id
        );
        if (stillInTimeEditor) {
          return;
        }
        if (state.editingTimeId !== id) {
          return;
        }
        await commitTimeEdit(id);
      });
    });
  }
  if (role === "add-input") {
    const value = event.target.value;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(async () => {
        const activeRole = document.activeElement?.dataset?.role;
        if (activeRole === "add-input") {
          return;
        }
        if (!state.addMode) {
          return;
        }
        await addCity(value);
      });
    });
  }
});

cardsEl.addEventListener("input", (event) => {
  const role = event.target?.dataset?.role;
  const id = event.target?.dataset?.id;

  if (role === "name-input" && id === state.editingNameId) {
    state.editingNameDraft = event.target.value;
    state.editingNameTouched = true;
    state.focusTarget = {
      type: "name",
      id,
      caretStart: event.target.selectionStart ?? event.target.value.length,
      caretEnd: event.target.selectionEnd ?? event.target.value.length
    };
    render();
  }

  if (role === "add-input" && state.addMode) {
    state.addDraft = event.target.value;
    state.addTouched = true;
    state.focusTarget = {
      type: "add",
      caretStart: event.target.selectionStart ?? event.target.value.length,
      caretEnd: event.target.selectionEnd ?? event.target.value.length
    };
    render();
  }

  if ((role === "time-hour" || role === "time-minute") && id === state.editingTimeId) {
    const city = state.cities.find((item) => item.id === id);
    if (!city) {
      return;
    }
    const baseDraft = getCityEditingTimeDraft(city);
    state.editingTimeDraft = {
      ...baseDraft,
      ...state.editingTimeDraft,
      id,
      [role === "time-hour" ? "hour" : "minute"]: event.target.value
    };
    state.focusTarget = {
      type: "time-segment",
      id,
      segment: role,
      caretStart: event.target.selectionStart ?? event.target.value.length,
      caretEnd: event.target.selectionEnd ?? event.target.value.length
    };
    syncEditingTimeDraft(id).then(() => {
      render();
    });
  }
});

cardsEl.addEventListener("change", (event) => {
  const role = event.target?.dataset?.role;
  const id = event.target?.dataset?.id;

  if (role === "time-period" && id === state.editingTimeId) {
    const city = state.cities.find((item) => item.id === id);
    if (!city) {
      return;
    }
    const baseDraft = getCityEditingTimeDraft(city);
    state.editingTimeDraft = {
      ...baseDraft,
      ...state.editingTimeDraft,
      id,
      period: event.target.value
    };
    state.focusTarget = {
      type: "time-segment",
      id,
      segment: "time-period"
    };
    syncEditingTimeDraft(id).then(() => {
      render();
    });
  }
});

cardsEl.addEventListener("wheel", (event) => {
  const role = event.target?.dataset?.role;
  const id = event.target?.dataset?.id;
  if (!id || (role !== "time-hour" && role !== "time-minute")) {
    return;
  }

  event.preventDefault();
  adjustEditingTimeDraftSegment(id, role, event.deltaY > 0 ? -1 : 1);
  state.focusTarget = {
    type: "time-segment",
    id,
    segment: role,
    selectAll: true
  };
  syncEditingTimeDraft(id).then(() => {
    render();
  });
}, { passive: false });

cardsEl.addEventListener("mousedown", async (event) => {
  if (event.target?.closest('[data-role="remove-city"]')) {
    event.preventDefault();
    const button = event.target.closest('[data-role="remove-city"]');
    await removeCity(button.dataset.id);
    return;
  }

  if (event.target?.closest('[data-role="name-suggestion"]')) {
    event.preventDefault();
    const option = event.target.closest('[data-role="name-suggestion"]');
    await applyNameSuggestion(
      option.dataset.id,
      option.dataset.label,
      option.dataset.timeZone
    );
  }

  if (event.target?.closest('[data-role="add-suggestion"]')) {
    event.preventDefault();
    const option = event.target.closest('[data-role="add-suggestion"]');
    await addCitySuggestion(
      option.dataset.label,
      option.dataset.timeZone
    );
  }
});

initialize();

calendarToggleButtonEl.addEventListener("click", () => {
  state.activeView = state.activeView === "calendar" ? "timezones" : "calendar";
  state.settingsOpen = false;
  state.addMode = false;
  state.addDraft = "";
  state.addTouched = false;
  state.editingNameId = null;
  state.editingNameDraft = "";
  state.editingNameTouched = false;
  state.editingTimeId = null;
  state.editingTimeDraft = null;
  state.focusTarget = null;
  if (state.activeView === "calendar") {
    ensureCalendarState(true);
  }
  render();
});

headerAddButtonEl.addEventListener("click", () => {
  state.settingsOpen = false;
  state.addMode = !state.addMode;
  state.addDraft = "";
  state.addTouched = false;
  state.focusTarget = state.addMode ? { type: "add", selectAll: false } : null;
  render();
});

calendarDateEl.addEventListener("input", () => {
  state.calendar.date = calendarDateEl.value;
  renderCalendarView();
});

calendarHourEl.addEventListener("input", () => {
  setCalendarTimeParts(calendarHourEl.value, calendarMinuteEl.value, calendarPeriodEl.value);
  renderCalendarView();
});

calendarMinuteEl.addEventListener("input", () => {
  setCalendarTimeParts(calendarHourEl.value, calendarMinuteEl.value, calendarPeriodEl.value);
  renderCalendarView();
});

calendarPeriodEl.addEventListener("change", () => {
  setCalendarTimeParts(calendarHourEl.value, calendarMinuteEl.value, calendarPeriodEl.value);
  renderCalendarView();
});

calendarTitleEl.addEventListener("input", () => {
  state.calendar.title = calendarTitleEl.value;
});

durationOptionsEl.addEventListener("click", (event) => {
  if (event.target?.dataset?.role !== "duration-option") {
    return;
  }
  state.calendar.durationMinutes = Number(event.target.dataset.minutes) || 30;
  renderCalendarView();
});

calendarHourEl.addEventListener("wheel", (event) => {
  event.preventDefault();
  adjustCalendarTimeSegment("hour", event.deltaY > 0 ? -1 : 1);
  renderCalendarView();
  calendarHourEl.focus();
});

calendarMinuteEl.addEventListener("wheel", (event) => {
  event.preventDefault();
  adjustCalendarTimeSegment("minute", event.deltaY > 0 ? -1 : 1);
  renderCalendarView();
  calendarMinuteEl.focus();
});

calendarSubmitEl.addEventListener("click", () => {
  const url = getCalendarEventUrl();
  if (!url) {
    return;
  }
  if (globalThis.chrome?.tabs?.create) {
    chrome.tabs.create({ url });
    return;
  }
  window.open(url, "_blank");
});

headerResetButtonEl.addEventListener("click", async () => {
  if (!state.compareState) {
    return;
  }
  state.compareState = null;
  state.editingTimeId = null;
  state.editingTimeDraft = null;
  await persist();
  render();
});

settingsButtonEl.addEventListener("click", (event) => {
  event.stopPropagation();
  state.addMode = false;
  state.settingsOpen = !state.settingsOpen;
  render();
});

settingsPopoverEl.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-role]");
  if (!actionButton) {
    return;
  }

  if (actionButton.dataset.role === "pin-first-timezone") {
    state.preferences.pinFirstTimezone = !isFirstTimezonePinned();
    state.settingsOpen = false;
    await persist();
    render();
    return;
  }

  if (actionButton.dataset.role === "open-in-side-panel") {
    const nextOpenInSidePanel = state.preferences.openInSidePanel !== true;
    state.preferences.openInSidePanel = nextOpenInSidePanel;
    state.settingsOpen = false;
    await persist();
    chrome.runtime?.sendMessage?.({ type: "times:preferences-updated" });

    if (nextOpenInSidePanel && surface === "popup" && globalThis.chrome?.sidePanel?.open) {
      try {
        const currentWindow = await chrome.windows.getCurrent();
        if (currentWindow?.id) {
          await chrome.sidePanel.open({ windowId: currentWindow.id });
          window.close();
          return;
        }
      } catch (error) {
        console.error("Unable to switch from popup to side panel", error);
      }
    }

    render();
    return;
  }

  if (actionButton.dataset.role === "dark-mode") {
    state.preferences.darkMode = state.preferences.darkMode !== true;
    state.settingsOpen = false;
    await persist();
    render();
    return;
  }

  if (actionButton.dataset.role !== "time-format") {
    return;
  }

  state.preferences.timeFormat = actionButton.dataset.format === "24h" ? "24h" : "12h";
  state.settingsOpen = false;
  await persist();
  render();
});

document.addEventListener("click", (event) => {
  if (
    state.settingsOpen &&
    event.target !== settingsButtonEl &&
    !settingsPopoverEl.contains(event.target)
  ) {
    state.settingsOpen = false;
    render();
  }
});
