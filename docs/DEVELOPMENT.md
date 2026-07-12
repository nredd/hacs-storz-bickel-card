# Development

Toolchain and architecture notes for `storz-bickel-card`. For installation and configuration, see
the [README](../README.md).

## How the card ships

This repo builds and releases `dist/storz-bickel-card.js` as a **GitHub Release asset**, installed
through HACS's Lovelace plugin category (or manually, per the README). This replaces the old
`hacs-storz-bickel` (integration repo) model, where the built bundle was committed to
`custom_components/storz_bickel/www/` and auto-registered on Home Assistant boot via
`frontend.add_extra_js_url` — that mechanism is gone now that the card is a standalone HACS
repo. Users add the card as a dashboard resource the same way as any other HACS Lovelace plugin;
see the README's [Installation](../README.md#installation) section.

## Toolchain

The card is TypeScript + [Lit](https://lit.dev), with a deliberately small toolchain:

| Concern        | Tool                                       |
| -------------- | ------------------------------------------- |
| Install        | `bun install` (lockfile: `bun.lock`)         |
| Bundle         | `bun build` (single minified ES module)      |
| Tests          | `bun test` (Jest-compatible) + happy-dom      |
| Lint + format  | Biome (`biome ci` / `biome check --write`)     |
| Types          | strict `tsc --noEmit`                           |

Bun is pinned in `.bun-version` (kept in sync with the Bun feature version in
`.devcontainer/devcontainer.json`). The production build sets `NODE_ENV=production` to select
Lit's production export condition.

### Development workflow

```bash
script/setup         # bun install --frozen-lockfile
script/lint          # Biome, fix mode
script/lint-check    # Biome, CI mode (no writes)
script/type-check    # strict tsc
script/test          # bun test --coverage
script/build         # production bundle -> dist/storz-bickel-card.js
script/check         # the full gate, exactly as CI runs it
```

## Architecture notes

- **Device-based config.** The card takes a device registry id, not a pile of entity ids. Entity
  ids are derived in `src/entities.ts` from `hass.entities` by matching
  `platform === "storz_bickel"` and each entry's `translation_key` (the integration sets it equal
  to the entity description key). This survives entity renames and doubles as capability
  detection: no `pump` entity → no AIR toggle (Venty/Crafty), no `battery` sensor → no battery
  chip (Volcano).
- **Single source of truth for heat.** The HEAT toggle drives the `climate` entity
  (`set_hvac_mode`), never a parallel heater switch.
- **Optimistic steppers and dial drags.** The ± stepper and dragging the dial update a pending
  target immediately and debounce ~500 ms before calling `climate.set_temperature`.
- **Pump safety stays server-side.** The card just toggles the pump switch; failsafe/cooldown
  enforcement lives in the integration's pump guard. The pump failsafe/cooldown *duration*
  dropdowns in the device-info panel write to the config entry's options (`number.set_value` on an
  option-backed number entity), which reloads the entry — the same mechanism the options flow
  itself uses. This is a real, if infrequent, UX cost (a BLE reconnect per change).
- **No HA frontend imports.** The card hand-rolls the minimal `hass` typings it needs
  (`src/types.ts`) and uses native elements (`<details>`, `<input type="range">`, `<select>`)
  styled with HA theme variables, so it has zero runtime dependencies beyond Lit and works in
  happy-dom tests.
- **Self-registering subcomponents.** Each subcomponent module (`dial.ts`, `seven-segment.ts`,
  `history-chart.ts`, `sessions-chart.ts`) calls `customElements.define` for its own tag at the
  bottom of the file (guarded by `customElements.get`), so importing a subcomponent directly (as
  the tests do) is enough to register it — no central registry.
- **Dashboard layout is a literal port, not a redesign.** The two-column layout (readout, dial,
  stepper, HEAT/AIR on the left; session/history/sessions/device-info panels on the right) and the
  dial's rotating-knob mechanism were ported pixel-for-pixel from a design mockup rather than
  reinterpreted — see the geometry comments at the top of `src/dial.ts`. It reflows to a single
  column under a `@container` query for narrow dashboard slots.
- **No external fonts or charting libraries.** The seven-segment readout and both charts
  (`history-chart.ts`, `sessions-chart.ts`) are hand-built with CSS and SVG, matching the dial's
  approach, so the card stays a single self-contained bundle with no CDN font/script dependency
  (important for HA installs without outbound internet access).
- **Temperature history has no dedicated backend entity.** `history-chart.ts` queries HA's
  `history/period` REST API directly against the `temperature` sensor (already
  `state_class: measurement`, so it's recorder/LTS-eligible out of the box) instead of requiring a
  new integration-side sensor.
- **Sessions-per-day comes from `session_history`'s `daily_counts` attribute** (alongside the
  48h `sessions` attribute — see the integration's `custom_components/storz_bickel/session/entities.py`),
  bucketed from the tracker's full in-memory lifetime session list, not just the short live-view
  window.
