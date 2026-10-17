// Station Météo — main application logic
// Vanilla JS, no framework, no build step.

// ─── Constants ───────────────────────────────────────────────────────────────

const API_WEATHER = "https://api.open-meteo.com/v1/forecast";
const API_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS  = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const OSM_TILES   = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const DEFAULT_LOCATION = { name: "Vannes", lat: 47.6583, lon: -2.7667 };
const STORAGE_KEY = "station-meteo-location";
const WEATHER_REFRESH_MS = 3 * 60 * 1000; // 3 minutes

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  location: loadLocation(),
  selected: null,       // currently selected search result (before saving)
  map: null,            // Leaflet map instance
  mapMarker: null,
  leafletLoaded: false,
};

// ─── DOM helpers ─────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.lat === "number" && typeof parsed.lon === "number") {
        return parsed;
      }
    }
  } catch (_) { /* ignore */ }
  return { ...DEFAULT_LOCATION };
}

function saveLocation(loc) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
}

// ─── Clock ───────────────────────────────────────────────────────────────────

const clockFormatters = new Map();

function clockFormatter() {
  const tz = state.location.timezone;
  if (!clockFormatters.has(tz)) {
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat("fr-FR", {
        timeZone: tz,
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (_) {
      // Unknown or unsupported timezone: fall back to the device timezone.
      fmt = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    }
    clockFormatters.set(tz, fmt);
  }
  return clockFormatters.get(tz);
}

function updateClock() {
  const now = new Date();
  const parts = {};
  for (const part of clockFormatter().formatToParts(now)) parts[part.type] = part.value;
  const hh = parts.hour === "24" ? "00" : parts.hour;
  $("clock-hm").textContent = `${hh}:${parts.minute}`;
  $("clock-ss").textContent = `:${parts.second}`;
  $("date").textContent = `${parts.weekday} ${parts.day} ${parts.month}`;
}

// ─── Weather ─────────────────────────────────────────────────────────────────

async function fetchWeather() {
  const { lat, lon } = state.location;
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,weather_code",
    timezone: "auto",
  });
  const res = await fetch(`${API_WEATHER}?${params}`);
  if (!res.ok) throw new Error(`Weather API: ${res.status}`);
  return res.json();
}

function renderWeather(data) {
  const cur = data.current;
  const temp = Math.round(cur.temperature_2m * 10) / 10;
  const apparent = Math.round(cur.apparent_temperature * 10) / 10;

  $("temp-exterior").innerHTML = `${temp}<span class="unit">°C</span>`;
  $("temp-apparent").innerHTML = `${apparent}<span class="unit">°C</span>`;

  const { icon, label } = weatherCodeToInfo(cur.weather_code);
  $("condition-icon").innerHTML = icon;
  $("condition-label").textContent = label;
}

async function refreshWeather() {
  try {
    const data = await fetchWeather();
    renderWeather(data);
    setLocationTimezone(data.timezone);
  } catch (err) {
    console.error("Weather fetch failed:", err);
    $("temp-exterior").textContent = "—";
    $("temp-apparent").textContent = "—";
    $("condition-label").textContent = "Météo indisponible";
  }
}

// ─── WMO weather codes → icon + French label ────────────────────────────────

function weatherCodeToInfo(code) {
  const icons = WEATHER_ICONS;
  if (code === 0) return { icon: icons.sun, label: "Dégagé" };
  if (code === 1) return { icon: icons.sunCloud, label: "Plutôt dégagé" };
  if (code === 2) return { icon: icons.cloudSun, label: "Partiellement nuageux" };
  if (code === 3) return { icon: icons.cloud, label: "Couvert" };
  if (code === 45 || code === 48) return { icon: icons.fog, label: "Brouillard" };
  if (code >= 51 && code <= 55) return { icon: icons.drizzle, label: "Bruine" };
  if (code >= 56 && code <= 57) return { icon: icons.drizzle, label: "Bruine verglaçante" };
  if (code >= 61 && code <= 65) return { icon: icons.rain, label: "Pluie" };
  if (code >= 66 && code <= 67) return { icon: icons.rain, label: "Pluie verglaçante" };
  if (code >= 71 && code <= 77) return { icon: icons.snow, label: "Neige" };
  if (code >= 80 && code <= 82) return { icon: icons.showers, label: "Averses" };
  if (code >= 85 && code <= 86) return { icon: icons.snow, label: "Averses de neige" };
  if (code >= 95) return { icon: icons.storm, label: "Orage" };
  return { icon: icons.cloud, label: "Nuageux" };
}

// Inline SVG weather icons (stroke-based, currentColor)
const WEATHER_ICONS = {
  sun: svgIcon(`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>`),
  sunCloud: svgIcon(`<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M2 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M8.05 12.65a4 4 0 0 1 5.93-4.13"/><path d="M11 22h6a5 5 0 1 0-4.9-6H11a3 3 0 1 0 0 6z"/>`),
  cloudSun: svgIcon(`<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 1 1 0 6z"/>`),
  cloud: svgIcon(`<path d="M17.5 19a4.5 4.5 0 0 0 .38-8.98 6 6 0 0 0-11.4 1.6A4 4 0 0 0 7 19h10.5z"/>`),
  fog: svgIcon(`<path d="M17.5 14a4.5 4.5 0 0 0 .38-8.98 6 6 0 0 0-11.4 1.6A4 4 0 0 0 7 14h10.5z"/><path d="M3 17.5h18M5 20h14M7 22.5h10"/>`),
  drizzle: svgIcon(`<path d="M17.5 16a4.5 4.5 0 0 0 .38-8.98 6 6 0 0 0-11.4 1.6A4 4 0 0 0 7 16h10.5z"/><path d="M8 19v2M12 20v2M16 19v2"/>`),
  rain: svgIcon(`<path d="M17.5 16a4.5 4.5 0 0 0 .38-8.98 6 6 0 0 0-11.4 1.6A4 4 0 0 0 7 16h10.5z"/><path d="M8 19l-1 3M12 19l-1 3M16 19l-1 3"/>`),
  showers: svgIcon(`<path d="M17.5 16a4.5 4.5 0 0 0 .38-8.98 6 6 0 0 0-11.4 1.6A4 4 0 0 0 7 16h10.5z"/><path d="M7 19l-1 3M11 19l-1 3M15 19l-1 3M19 19l-1 3"/>`),
  snow: svgIcon(`<path d="M7 5.1v3.8M5.35 6.05l3.3 1.9M8.65 6.05l-3.3 1.9M16 10.1v3.8M14.35 11.05l3.3 1.9M17.65 11.05l-3.3 1.9M10.5 16.1v3.8M8.85 17.05l3.3 1.9M12.15 17.05l-3.3 1.9"/>`),
  storm: svgIcon(`<path d="M17.5 16a4.5 4.5 0 0 0 .38-8.98 6 6 0 0 0-11.4 1.6A4 4 0 0 0 7 16"/><path d="m13 11.5-3 5h4l-3 5"/>`),
};

function svgIcon(inner) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// ─── Location display ────────────────────────────────────────────────────────

function renderLocation() {
  $("location-name").textContent = state.location.name || "—";
}

// Adopt the city's IANA timezone (from the weather or geocoding API) so the
// clock follows the selected location. Invalid names are rejected by the
// formatter constructor and ignored.
function setLocationTimezone(tz) {
  if (!tz || tz === state.location.timezone) return;
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: tz });
  } catch (_) {
    return;
  }
  state.location.timezone = tz;
  saveLocation(state.location);
}

// ─── Geocoding search ────────────────────────────────────────────────────────

let searchAbort = null;

async function searchPlaces(query) {
  if (searchAbort) searchAbort.abort();
  // AbortController is unavailable on very old WebKit (Safari 12.0) —
  // degrade to non-aborting requests there.
  searchAbort = "AbortController" in window ? new AbortController() : null;

  const params = new URLSearchParams({
    name: query,
    count: "8",
    language: "fr",
    format: "json",
  });

  try {
    const res = await fetch(`${API_GEOCODE}?${params}`, searchAbort ? { signal: searchAbort.signal } : undefined);
    if (!res.ok) throw new Error(`Geocode API: ${res.status}`);
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    if (err.name === "AbortError") return null;
    throw err;
  }
}

function renderSearchResults(results) {
  const list = $("search-results");
  list.innerHTML = "";

  if (!results || results.length === 0) {
    list.hidden = true;
    return;
  }

  for (const place of results) {
    const li = document.createElement("li");
    li.className = "search-result";
    const admin = place.admin1 ? `, ${place.admin1}` : "";
    const country = place.country ? ` — ${place.country}` : "";
    li.innerHTML = `
      <span class="result-name">${escapeHtml(place.name)}</span>
      <span class="result-detail">${escapeHtml(admin + country)}</span>
    `;
    li.addEventListener("click", () => selectPlace(place));
    list.appendChild(li);
  }

  list.hidden = false;
}

function selectPlace(place) {
  state.selected = {
    name: place.name + (place.admin1 ? `, ${place.admin1}` : "") + (place.country ? ` (${place.country})` : ""),
    lat: place.latitude,
    lon: place.longitude,
    timezone: place.timezone,
  };

  $("selected-label").textContent = state.selected.name;
  $("save-btn").disabled = false;

  // Highlight selected result
  document.querySelectorAll(".search-result").forEach((el) => el.classList.remove("selected"));
  // Update map
  if (state.map) {
    state.map.setView([place.latitude, place.longitude], 10);
    placeMarker(place.latitude, place.longitude);
  }
}

// ─── Geolocation ─────────────────────────────────────────────────────────────

function useGeolocation() {
  if (!navigator.geolocation) {
    alert("La géolocalisation n'est pas disponible sur cet appareil.");
    return;
  }
  $("geoloc-btn").disabled = true;
  $("geoloc-btn").textContent = "Localisation…";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      // Reverse geocode to get a name
      let name = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      try {
        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          count: "1",
          language: "fr",
          format: "json",
        });
        const res = await fetch(`${API_GEOCODE}?${params}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const p = data.results[0];
          name = p.name + (p.admin1 ? `, ${p.admin1}` : "") + (p.country ? ` (${p.country})` : "");
        }
      } catch (_) { /* keep coordinates as name */ }

      state.selected = { name, lat: latitude, lon: longitude };
      $("selected-label").textContent = name;
      $("save-btn").disabled = false;
      if (state.map) {
        state.map.setView([latitude, longitude], 10);
        placeMarker(latitude, longitude);
      }

      $("geoloc-btn").disabled = false;
      $("geoloc-btn").innerHTML = geolocBtnHtml;
    },
    (err) => {
      alert("Impossible d'obtenir la position : " + err.message);
      $("geoloc-btn").disabled = false;
      $("geoloc-btn").innerHTML = geolocBtnHtml;
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

const geolocBtnHtml = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> Utiliser ma position`;

// ─── Leaflet map (lazy-loaded) ───────────────────────────────────────────────

async function ensureLeaflet() {
  if (state.leafletLoaded) return;
  state.leafletLoaded = true;

  // Inject CSS
  if (!document.querySelector('link[href*="leaflet"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }

  // Inject JS
  if (typeof L === "undefined") {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = LEAFLET_JS;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load Leaflet"));
      document.head.appendChild(script);
    });
  }
}

async function initMap() {
  $("map-container").hidden = false;
  await ensureLeaflet();

  // Leaflet needs the container to be visible AND laid out before init.
  // Double rAF + invalidateSize ensures correct dimensions.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  if (state.map) {
    state.map.invalidateSize();
    return;
  }

  const { lat, lon } = state.selected || state.location;
  state.map = L.map("map", { zoomControl: true, attributionControl: true }).setView([lat, lon], 10);
  L.tileLayer(OSM_TILES, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(state.map);
  placeMarker(lat, lon);

  // Extra invalidateSize after tiles start loading
  setTimeout(() => state.map && state.map.invalidateSize(), 300);
}

function placeMarker(lat, lon) {
  if (!state.map) return;
  if (state.mapMarker) state.map.removeLayer(state.mapMarker);
  state.mapMarker = L.marker([lat, lon]).addTo(state.map);
}

// ─── Settings panel ──────────────────────────────────────────────────────────

function openSettings() {
  $("settings-overlay").hidden = false;
  document.body.classList.add("settings-open");
  $("search-input").focus();
  if (!state.map) {
    initMap();
  } else {
    // Map already exists — just fix sizing after the overlay becomes visible
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (state.map) state.map.invalidateSize();
    }));
  }
}

function closeSettings() {
  $("settings-overlay").hidden = true;
  document.body.classList.remove("settings-open");
  // Reset selection state
  state.selected = null;
  $("save-btn").disabled = true;
  $("selected-label").textContent = state.location.name || "Aucune position sélectionnée";
  $("search-results").hidden = true;
  $("search-input").value = "";
}

function saveSettings() {
  if (!state.selected) return;
  state.location = state.selected;
  saveLocation(state.location);
  renderLocation();
  closeSettings();
  refreshWeather();
}

// ─── Search input handling (debounced) ───────────────────────────────────────

let searchTimer = null;

function onSearchInput() {
  const query = $("search-input").value.trim();
  clearTimeout(searchTimer);
  if (query.length < 2) {
    $("search-results").hidden = true;
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const results = await searchPlaces(query);
      if (results !== null) renderSearchResults(results);
    } catch (err) {
      console.error("Search failed:", err);
    }
  }, 300);
}

// ─── Screen lock prevention ──────────────────────────────────────────────────

function preventScreenLock() {
  const video = $("fake-video");
  const play = () => {
    video.play().catch(() => {});
    document.body.removeEventListener("touchend", play);
    document.body.removeEventListener("click", play);
  };
  document.body.addEventListener("touchend", play);
  document.body.addEventListener("click", play);
  video.play().catch(() => {});
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ─── Init ────────────────────────────────────────────────────────────────────

function init() {
  // Clock
  updateClock();
  setInterval(updateClock, 250);

  // Weather
  renderLocation();
  refreshWeather();
  setInterval(refreshWeather, WEATHER_REFRESH_MS);

  // Screen lock
  preventScreenLock();

  // Settings
  $("settings-btn").addEventListener("click", openSettings);
  $("settings-close").addEventListener("click", closeSettings);
  $("settings-overlay").addEventListener("click", (e) => {
    if (e.target === $("settings-overlay")) closeSettings();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettings();
  });

  // Search
  $("search-input").addEventListener("input", onSearchInput);
  $("search-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearchInput();
    }
  });
  $("search-btn").addEventListener("click", async () => {
    const query = $("search-input").value.trim();
    if (query.length < 2) return;
    try {
      const results = await searchPlaces(query);
      if (results !== null) renderSearchResults(results);
    } catch (err) {
      console.error("Search failed:", err);
    }
  });

  // Geolocation
  $("geoloc-btn").innerHTML = geolocBtnHtml;
  $("geoloc-btn").addEventListener("click", useGeolocation);

  // Save
  $("save-btn").addEventListener("click", saveSettings);

  // Initialize selected label
  $("selected-label").textContent = state.location.name || "Aucune position sélectionnée";
}

document.addEventListener("DOMContentLoaded", init);
