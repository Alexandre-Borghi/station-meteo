// Browser test for Station Météo
// Uses puppeteer-core + the Chromium binary from the Nix devshell.
// Run inside `nix develop`:  node tests/browser-test.mjs

import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const CHROMIUM = process.env.CHROMIUM_BIN || "/run/current-system/sw/bin/chromium";
const BASE_URL = process.env.BASE_URL || "http://localhost:8000";
const SCREENSHOT_DIR = new URL("../screenshots/", import.meta.url).pathname;

const VIEWPORTS = [
  { name: "tablet-landscape", width: 1280, height: 800 },
  { name: "tablet-portrait",  width: 800,  height: 1280 },
  { name: "desktop",          width: 1920, height: 1080 },
  { name: "small",            width: 480,  height: 800 },
];

let failures = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ ${msg}`);
  } else {
    console.error(`  ❌ ${msg}`);
    failures++;
  }
}

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });

  console.log(`Launching Chromium: ${CHROMIUM}`);
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();

    // ── Test 1: Page loads and has correct title ──────────────────────────
    console.log("\n── Test: page load ──");
    await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
    const title = await page.title();
    assert(title === "Station Météo", `title is "Station Météo" (got "${title}")`);

    // ── Test 2: Clock is present and ticking ──────────────────────────────
    console.log("\n── Test: clock ──");
    const clockText1 = await page.$eval("#clock-hm", (el) => el.textContent);
    assert(/^\d{2}:\d{2}$/.test(clockText1), `clock shows HH:MM (got "${clockText1}")`);
    const ssText = await page.$eval("#clock-ss", (el) => el.textContent);
    assert(/^:\d{2}$/.test(ssText), `seconds shown (got "${ssText}")`);

    // Wait 2 seconds, check seconds changed
    await new Promise((r) => setTimeout(r, 2100));
    const ssText2 = await page.$eval("#clock-ss", (el) => el.textContent);
    assert(ssText !== ssText2, `clock ticks (${ssText} → ${ssText2})`);

    // ── Test 3: Weather data loads ────────────────────────────────────────
    console.log("\n── Test: weather ──");
    // Wait for weather API call (may take a few seconds)
    await page.waitForFunction(
      () => {
        const el = document.getElementById("temp-exterior");
        return el && /\d/.test(el.textContent);
      },
      { timeout: 20000 }
    );
    const tempExt = await page.$eval("#temp-exterior", (el) => el.textContent);
    assert(/^-?\d+(\.\d+)?°C/.test(tempExt), `exterior temp has value (got "${tempExt}")`);
    const tempApp = await page.$eval("#temp-apparent", (el) => el.textContent);
    assert(/^-?\d+(\.\d+)?°C/.test(tempApp), `apparent temp has value (got "${tempApp}")`);
    const condLabel = await page.$eval("#condition-label", (el) => el.textContent);
    assert(condLabel.length > 1 && condLabel !== "—", `condition label set (got "${condLabel}")`);

    // ── Test 4: Location name shown ───────────────────────────────────────
    console.log("\n── Test: location ──");
    const locName = await page.$eval("#location-name", (el) => el.textContent);
    assert(locName.length > 1 && locName !== "—", `location name shown (got "${locName}")`);

    // ── Test 5: Date is shown ─────────────────────────────────────────────
    console.log("\n── Test: date ──");
    const dateText = await page.$eval("#date", (el) => el.textContent);
    assert(dateText.length > 3 && dateText !== "—", `date shown (got "${dateText}")`);

    // ── Test 6: Settings panel opens/closes ───────────────────────────────
    console.log("\n── Test: settings panel ──");
    await page.click("#settings-btn");
    await page.waitForSelector("#settings-overlay:not([hidden])", { timeout: 5000 });
    const overlayVisible = await page.$eval("#settings-overlay", (el) => !el.hidden);
    assert(overlayVisible, "settings overlay opens");

    const searchInputVisible = await page.$eval("#search-input", (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    assert(searchInputVisible, "search input is visible");

    // ── Test 7: Location search ───────────────────────────────────────────
    console.log("\n── Test: location search ──");
    await page.type("#search-input", "Quimper", { delay: 30 });
    // Wait for debounced search + API response
    await page.waitForSelector("#search-results:not([hidden]) .search-result", { timeout: 15000 });
    const resultCount = await page.$$eval(".search-result", (els) => els.length);
    assert(resultCount > 0, `search returns results (${resultCount} found)`);
    const firstResult = await page.$eval(".search-result .result-name", (el) => el.textContent);
    console.log(`  first result: "${firstResult}"`);

    // Click first result
    await page.click(".search-result");
    await new Promise((r) => setTimeout(r, 300));
    const saveEnabled = await page.$eval("#save-btn", (el) => !el.disabled);
    assert(saveEnabled, "save button enabled after selecting result");
    const selectedLabel = await page.$eval("#selected-label", (el) => el.textContent);
    assert(selectedLabel.includes("Quimper"), `selected location shows Quimper (got "${selectedLabel}")`);

    // Close with Escape
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 300));
    const overlayHidden = await page.$eval("#settings-overlay", (el) => el.hidden);
    assert(overlayHidden, "settings overlay closes on Escape");

    // ── Test 6: Screenshots at multiple viewports ─────────────────────────
    console.log("\n── Test: screenshots ──");
    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await new Promise((r) => setTimeout(r, 500));
      const path = `${SCREENSHOT_DIR}${vp.name}.png`;
      await page.screenshot({ path, fullPage: false });
      console.log(`  📸 ${vp.name} (${vp.width}×${vp.height}) → screenshots/${vp.name}.png`);
    }

    // Settings panel screenshot (with search results)
    await page.setViewport({ width: 1280, height: 800 });
    await page.click("#settings-btn");
    await page.type("#search-input", "Lyon", { delay: 20 });
    await page.waitForSelector("#search-results:not([hidden]) .search-result", { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2500)); // wait for map + results
    await page.screenshot({ path: `${SCREENSHOT_DIR}settings.png`, fullPage: false });
    console.log(`  📸 settings panel → screenshots/settings.png`);
    await page.keyboard.press("Escape");

  } finally {
    await browser.close();
  }

  console.log(`\n${"─".repeat(50)}`);
  if (failures > 0) {
    console.error(`❌ ${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log("✅ All tests passed");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
