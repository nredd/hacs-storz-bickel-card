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

`custom:storz-bickel-card` is a two-column dashboard card for Storz & Bickel vaporizers (Volcano,
Venty, Crafty): a dual current/target temperature readout with a °F/°C toggle, a rotating-knob
thermostat dial (drag it, or use the −/+ stepper), preset chips, and HEAT/AIR toggle buttons on
the left; a live session timer with today's session count, a temperature history chart, a
sessions-per-day chart, and a device-info panel (runtime, firmware, and dropdowns for
auto-shutoff, pump failsafe, pump cooldown, and temperature step) on the right. It reflows to a
single column in narrow dashboard slots.

The card adapts to the configured device: the AIR toggle appears only on the Volcano, the battery
chip only on portables, and boost/vibration rows only where supported. Entity lookups go through
the registry, so renaming entities never breaks the card.

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
you pick the device and preset temperatures; the equivalent YAML is:

```yaml
type: custom:storz-bickel-card
device: <device_id>        # pick via the visual editor
presets: [175, 185, 195]   # optional preset temperature chips
name: Volcano               # optional title override
```

| Name       | Type    | Required     | Description                                | Default              |
| ---------- | ------- | ------------ | ------------------------------------------- | --------------------- |
| `type`     | string  | **Required** | `custom:storz-bickel-card`                  |                        |
| `device`   | string  | **Required** | Device registry id of the Storz & Bickel device | `none` (editor-only) |
| `presets`  | number[] | **Optional** | Preset temperature chips                   | `none`                 |
| `name`     | string  | **Optional** | Card title override                        | Device name            |

> **Reconnects on pump/step changes.** The pump failsafe, pump cooldown, and temperature-step
> dropdowns in the device-info panel configure integration behavior (not the physical device), so
> changing one reloads the integration's config entry — a brief BLE reconnect, the same as
> changing them via the integration's own options flow.

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

| Command          | Description                                          |
| ---------------- | ----------------------------------------------------- |
| `bun run build`  | Production bundle (minified, ES module)                |
| `bun run dev`    | Watch-mode build with hot reload                        |
| `bun run serve`  | Static server on port 5000 (pair with `dev`)             |
| `bun run lint`   | Biome lint + format check (CI mode)                       |
| `bun run check`  | `tsc --noEmit`                                            |
| `bun test`       | `bun test --coverage`                                      |
| `script/check`   | Full CI gate: lint-check + type-check + test               |

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
