# Station Météo

A lightweight **weather station PWA** designed to sit on an idle tablet on a
living-room table. Shows a large clock and current outdoor weather (temperature
+ apparent temperature) for a configurable location.

## What this project is

- **Pure vanilla HTML/CSS/JS** — no framework, no build step, no bundler.
- **Progressive Web App** — installable, runs fullscreen, works offline (after
  first load, cached assets).
- **Targets old hardware** — must stay lightweight. No heavy JS frameworks.
  External libraries are loaded lazily and only when needed (e.g. Leaflet for
  the map is fetched on-demand when the settings panel opens).
- **Data sources** (all free, no API key):
  - Weather: [Open-Meteo](https://open-meteo.com/) — `api.open-meteo.com`
  - Geocoding: [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api)
  - Map tiles: [OpenStreetMap](https://www.openstreetmap.org/) via
    [Leaflet](https://leafletjs.com/) (lazy-loaded)

## Project structure

```
├── index.html          # Main app entry point
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (caches app shell, never caches API)
├── flake.nix           # Nix devshell — all tools come from here
├── flake.lock          # Locked nixpkgs revision (commit this)
├── css/
│   └── style.css       # All styles
├── js/
│   └── app.js          # All application logic
├── assets/
│   ├── icons/          # PWA icons (192, 512, favicon, apple-touch)
│   ├── icons-src/      # SVG source for icons (edit these, regenerate PNGs)
│   └── fonts/
│       └── 7segments.ttf
├── tests/
│   └── browser-test.mjs  # Puppeteer-core browser test + screenshot script
├── package.json        # Dev-only: puppeteer-core for tests
└── .worktrees/         # Git worktrees (gitignored — see below)
```

## Nix flake — everything lives here

**All tooling comes from the Nix flake devshell.** Do not install tools
system-wide. Enter the shell with:

```sh
nix develop
```

The devshell provides:

| Tool | Purpose |
|------|---------|
| `python3` | Dev server (`python3 -m http.server 8080`) |
| `chromium` | Headless browser for screenshots & tests |
| `nodejs_22` | Running puppeteer-core test scripts |
| `imagemagick` + `librsvg` | Generating PWA PNG icons from SVG |
| `curl`, `jq` | Debugging API calls |

### Common commands (inside `nix develop`)

```sh
# Start dev server
python3 -m http.server 8080
# → open http://localhost:8080

# Take a screenshot (headless chromium)
chromium --headless=new --no-sandbox \
  --screenshot=screenshots/desktop.png \
  --window-size=1920,1080 \
  http://localhost:8080

# Run browser tests (puppeteer-core + nix chromium)
node tests/browser-test.mjs

# Regenerate PWA icons from SVG sources
magick -background none assets/icons-src/icon.svg -resize 192x192 assets/icons/192.png
magick -background none assets/icons-src/icon.svg -resize 512x512 assets/icons/512.png
magick -background none assets/icons-src/icon.svg -resize 180x180 assets/icons/apple-touch.png
magick -background none assets/icons-src/icon.svg -resize 32x32 assets/icons/favicon.png
```

## Git worktrees — branching convention

This repo uses **git worktrees** for parallel branches. Worktrees live in
`./.worktrees/` (gitignored). To create a new worktree:

```sh
# From the repo root (the main checkout)
mkdir -p .worktrees
git worktree add .worktrees/<name> -b <branch-name>

# Work inside it
cd .worktrees/<name>

# When done, merge back to main from the main checkout
git worktree list
git worktree remove .worktrees/<name>
```

**Always commit small, reviewable changes.** Commit early and often on your
branch.

## Coding practices

### General
- **No build step.** Edit files directly, reload the browser.
- **No framework.** Vanilla JS, ES modules if needed.
- **Keep it lightweight.** The target device is an old tablet. Avoid large
  dependencies. Lazy-load anything heavy.
- **French UI text** — the owner is French, the app lives in France. Keep
  user-facing strings in French.
- **Large text, high contrast** — the app is read from across a room. Use
  `vw`-based font sizes, high-contrast colors on a dark background.

### HTML
- Semantic elements, `lang="fr"`.
- PWA meta tags: manifest, theme-color, apple-touch-icon.
- Inline critical CSS via `<link>`, no `@import` chains.

### CSS
- CSS custom properties for colors at the top of `style.css`.
- Mobile-first but designed for a fixed landscape tablet.
- Use `prefers-reduced-motion` where animations exist.

### JavaScript
- Plain ES2022, no transpilation.
- `const`/`let`, arrow functions, `async/await`.
- Store user preferences (location) in `localStorage`.
- Handle fetch errors gracefully — show a message, don't crash.
- Keep the screen awake using the silent-video trick (see `index.html`).

### Icons / assets
- Edit SVG sources in `assets/icons-src/`.
- Regenerate PNGs with ImageMagick (see commands above).
- Required sizes: 192×192, 512×512, 180×180 (apple-touch), 32×32 (favicon).

### Testing
- Manual: load in browser, check clock ticks, weather loads, settings work.
- Automated: `node tests/browser-test.mjs` (puppeteer-core + nix chromium).
  Takes screenshots into `screenshots/` and asserts key DOM elements exist.
- Always take screenshots at multiple viewport sizes before committing UI
  changes.

### Commits
- Small, atomic commits with clear messages.
- Commit after each logical change (restructure, feature, style, fix).
- Never commit `node_modules/`, `screenshots/`, or `.worktrees/`.

## Features

1. **Clock** — large 7-segment display, HH:MM:SS, updates every second.
2. **Weather** — current outdoor temperature + apparent temperature from
   Open-Meteo, refreshed every 3 minutes.
3. **Location picker** — search any city/address via Open-Meteo Geocoding API.
   Optional Leaflet map for visual pin placement. Saved to `localStorage`.
4. **Screen lock prevention** — silent looping video keeps the tablet awake.
5. **PWA** — installable, fullscreen, custom icons.
6. **Weather condition display** — WMO weather code mapped to an icon +
   French description (e.g. "Ensoleillé", "Pluie", etc.).
