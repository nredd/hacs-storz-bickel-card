# Storz & Bickel Card

A custom Lovelace dashboard card for the
[`hacs-storz-bickel`](https://github.com/nredd/hacs-storz-bickel) Home Assistant integration.

[![GitHub Release][releases-shield]][releases]
[![License][license-shield]](LICENSE)
[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub Activity][commits-shield]][commits]

---

> **This is a separate repo, companion to
> [`nredd/hacs-storz-bickel`](https://github.com/nredd/hacs-storz-bickel).** The integration no
> longer bundles or auto-serves this card — install both repos through HACS: the integration
> (category: _Integration_) for the entities and BLE connection, and this repo (category:
> _plugin_/Lovelace) for the dashboard card. Releases, versioning, and CI are fully independent
> between the two.

---

## Overview

`custom:storz-bickel-card` is a wide two-column dashboard card for Storz & Bickel vaporizers
(Volcano, Venty, Crafty), a pixel-faithful port of its Claude Design prototype (vendored at
[`docs/design/`](docs/design/)): a 7-segment LCD current/target readout (DSEG7) with a °F/°C
toggle, a rotating-knob thermostat dial (drag it, use the −/+ stepper, or type a target), and
HEAT/AIR buttons with ember/wind particle effects on the left; a live session timer with today's
session count, a live temperature chart, a session-minutes bar chart, and a device-info panel
(runtime, firmware, and dropdowns for auto-shutoff, pump failsafe, and temperature step) on the
right.

The card lays out at a fixed 1328px design width and scales down/up **proportionally** to fit its
dashboard slot — it never reflows or stacks vertically. In sections view it requests the full row
(`columns: "full"`). All three fonts (Inter, JetBrains Mono, DSEG7 Classic) are bundled into the
JS as data URLs, so the card renders identically with no internet access (~280 KB of the bundle,
cached after first load).

Entity lookups go through the registry, so renaming entities never breaks the card. Missing
entities (e.g. no pump switch on portables) render as inert controls or `—` placeholders in the
same slots — the layout never shifts.

---

## Prerequisites

- The [`hacs-storz-bickel`](https://github.com/nredd/hacs-storz-bickel) integration installed and
  configured, with a Storz & Bickel device set up (Volcano, Venty, or Crafty).
- A modern Chromium/Firefox/Safari-based browser for the Lovelace dashboard.

## Installation

### HACS (recommended)

1. Add this repository as a custom repository in HACS (category: _Lovelace_ / plugin).
2. Install **Storz & Bickel Card**.
3. Refresh your browser (hard reload if the card doesn't appear immediately).

### Manual

1. Download `storz-bickel-card.js` from the [latest release][releases].
2. Copy it to `<config>/www/storz-bickel-card.js`.
3. Add a resource entry in your dashboard settings:

```yaml
resources:
  - url: /local/storz-bickel-card.js
    type: module
```

---

## Configuration

Open any dashboard, **Add card**, and search for **Storz & Bickel Card**. The visual editor lets
you pick the device and tune the button effects; the equivalent YAML is:

```yaml
type: custom:storz-bickel-card
device: <device_id>          # pick via the visual editor
name: Bag Bertha             # optional title override
heat_effect: Embers + glow   # optional effect options, defaults shown
ember_intensity: Steady
air_effect: Streaks + glow
wind_intensity: Steady
idle_breeze: false
```

| Name              | Type    | Required     | Description                                                          | Default          |
| ----------------- | ------- | ------------ | -------------------------------------------------------------------- | ---------------- |
| `type`            | string  | **Required** | `custom:storz-bickel-card`                                            |                  |
| `device`          | string  | **Required** | Device registry id of the Storz & Bickel device                       | `none`           |
| `name`            | string  | Optional     | Card title override                                                   | Device name      |
| `heat_effect`     | string  | Optional     | `Embers + glow` \| `Embers only` \| `Glow only` \| `Off`              | `Embers + glow`  |
| `ember_intensity` | string  | Optional     | `Smolder` \| `Steady` \| `Inferno`                                    | `Steady`         |
| `air_effect`      | string  | Optional     | `Streaks + glow` \| `Streaks only` \| `Glow only` \| `Off`            | `Streaks + glow` |
| `wind_intensity`  | string  | Optional     | `Breeze` \| `Steady` \| `Gale`                                        | `Steady`         |
| `idle_breeze`     | boolean | Optional     | Faint wind streaks on the AIR button while the pump is off            | `false`          |

> **Breaking change:** the `presets` option (preset temperature chips) was removed in the port to
> the final design, which has no preset row. Remove `presets:` from existing YAML configs.

> **Reconnects on pump-timeout changes.** The "Pump timeout" dropdown in the device-info panel
> configures integration behavior (not the physical device), so changing it reloads the
> integration's config entry — a brief BLE reconnect, the same as changing it via the
> integration's own options flow. The "Temperature increment" dropdown is card-local (it sets
> the −/+ stepper increment).

---

## Developer Guide

This project uses [Bun](https://bun.sh) for install/build/test and [Biome](https://biomejs.dev)
for lint/format — the TypeScript analogues of `uv`/`ruff` on the Python side. Zero runtime
dependencies beyond [Lit](https://lit.dev).

### Quick start — devcontainer (recommended)

The devcontainer gives you a full HA development environment in one click with no local setup
required.

1. Open the project in VS Code.
2. When prompted, click **Reopen in Container** (or run **Dev Containers: Rebuild Container**).
3. A local Home Assistant instance starts automatically at `http://localhost:8123` (`dev`/`dev`).
4. The card auto-loads via `LOVELACE_REMOTE_FILES` and hot-reloads on every save (`bun run dev` +
   `bun run serve` launch automatically).

**Requires:** [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
extension. See [`.devcontainer/README.md`](.devcontainer/README.md) for details.

### Quick start — local

```bash
git clone https://github.com/nredd/hacs-storz-bickel-card.git
cd hacs-storz-bickel-card

bun install --frozen-lockfile   # install locked dependencies
bun run build                    # verify the build works
bun run dev                      # start the watch-mode build
```

Then add your local `dist/storz-bickel-card.js` as a Lovelace resource (see Manual installation
above), or use the devcontainer where this is handled automatically.

### Available scripts

| Command                   | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| `bun run build`           | Production bundle (minified, ES module)                         |
| `bun run dev`             | Watch-mode build with hot reload                                |
| `bun run serve`           | Static server on port 5000 (pair with `dev`; `PORT=` overrides) |
| `bun run generate:fonts`  | Regenerate `src/font-data.gen.ts` from the @fontsource packages |
| `bun run lint`            | Biome lint + format check (CI mode)                             |
| `bun run check`           | `tsc --noEmit`                                                  |
| `bun test`                | `bun test --coverage`                                           |
| `script/check`            | Full CI gate: lint-check + type-check + test                    |

With `bun run serve` running, `http://localhost:5000/preview` serves the card against a simulated
Volcano (no HA needed) for side-by-side pixel comparison with the design prototype — open
[`docs/design/vaporizer-card-final.dc.html`](docs/design/vaporizer-card-final.dc.html) next to it.
The design source of truth and its code mapping live in [`docs/design/`](docs/design/).

Full toolchain details and architecture notes live in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md).

---

## See also

- [`nredd/hacs-storz-bickel`](https://github.com/nredd/hacs-storz-bickel) — the Home Assistant
  integration this card is a companion to (BLE connection, entities, session tracking).

---

[commits-shield]: https://img.shields.io/github/commit-activity/y/nredd/hacs-storz-bickel-card.svg?style=for-the-badge
[commits]: https://github.com/nredd/hacs-storz-bickel-card/commits/master
[license-shield]: https://img.shields.io/github/license/nredd/hacs-storz-bickel-card.svg?style=for-the-badge
[releases-shield]: https://img.shields.io/github/release/nredd/hacs-storz-bickel-card.svg?style=for-the-badge
[releases]: https://github.com/nredd/hacs-storz-bickel-card/releases
