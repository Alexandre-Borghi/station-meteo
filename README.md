# Station Météo

A lightweight **weather station PWA** for an idle tablet on the living-room
table. Shows a large clock and current outdoor weather (temperature + apparent
temperature) for a configurable location.

Pure vanilla HTML/CSS/JS — no framework, no build step.

## Features

- 🕐 Large 7-segment clock (HH:MM:SS)
- 🌡️ Current outdoor temperature & apparent temperature
- 🌤️ Weather condition icon + French description (WMO codes)
- 📍 Configurable location — search any city/address, or use GPS
- 🗺️ Optional map (Leaflet + OpenStreetMap, lazy-loaded)
- 🔒 Screen-lock prevention (silent video trick)
- 📱 Installable PWA (fullscreen, custom icons)

## Data sources (free, no API key)

| Service | Provider | URL |
|---------|----------|-----|
| Weather | Open-Meteo | `api.open-meteo.com` |
| Geocoding | Open-Meteo | `geocoding-api.open-meteo.com` |
| Map tiles | OpenStreetMap | `tile.openstreetmap.org` |

## Development

Everything runs from a **Nix flake devshell**:

```sh
nix develop
```

Inside the shell:

```sh
# Start dev server → http://localhost:8000
python3 -m http.server 8000

# Run browser tests + screenshots
npm install        # one-time: installs puppeteer-core
node tests/browser-test.mjs

# Take a quick screenshot
chromium --headless=new --no-sandbox \
  --screenshot=screenshots/manual.png \
  --window-size=1280,800 \
  http://localhost:8000
```

## Project structure

```
├── index.html          # App entry point
├── manifest.json       # PWA manifest
├── flake.nix           # Nix devshell (all tools)
├── css/style.css       # All styles
├── js/app.js           # All logic
├── assets/
│   ├── icons/          # PWA icons (generated PNGs)
│   ├── icons-src/      # SVG icon source
│   └── fonts/          # 7-segment font
├── tests/              # Browser tests (puppeteer-core)
└── .worktrees/         # Git worktrees (gitignored)
```

## Git worktrees

Branches are developed in git worktrees under `./.worktrees/`:

```sh
git worktree add .worktrees/<name> -b <branch>
```

See [AGENTS.md](AGENTS.md) for full conventions.
