# GitHub Copilot Instructions

You are assisting with development of `storz-bickel-card`, the companion Lovelace card for the
[`hacs-storz-bickel`](https://github.com/nredd/hacs-storz-bickel) Home Assistant integration. The
codebase is TypeScript + [Lit](https://lit.dev), bundled with `bun build` — deliberately
dependency-light (only `lit` at runtime).

Use these instructions as project-specific guardrails when generating, editing, or reviewing code.

## Quick reference

### Core commands

```bash
bun install --frozen-lockfile   # install locked dependencies
bun run dev                     # watch-mode build
bun run serve                   # static server on port 5000 (pair with dev)
bun run build                   # production bundle -> dist/storz-bickel-card.js
bun run lint                    # Biome lint + format check
bun run check                   # tsc --noEmit
bun test                        # bun test --coverage
```

`script/check` runs the full CI gate (lint-check + type-check + test) in one command.

### Primary files

- `src/storz-bickel-card.ts` — main card element, `LitElement` subclass registered as
  `custom:storz-bickel-card`
- `src/editor.ts` — visual editor (device picker, preset temperatures)
- `src/types.ts` — card config and `hass` typings (hand-rolled, no `custom-card-helpers` or HA
  frontend imports)
- `src/entities.ts` — derives entity ids from the device registry via
  `platform === "storz_bickel"` + `translation_key`, doubling as capability detection
- `src/const.ts` — `CARD_VERSION`, custom element tag constants
- `src/dial.ts`, `src/seven-segment.ts`, `src/history-chart.ts`, `src/sessions-chart.ts` —
  self-registering subcomponents (each calls `customElements.define` for its own tag)
- `src/styles.ts` — shared CSS

## Architecture and patterns

- The custom element is `custom:storz-bickel-card`.
- **Device-based config.** The card takes a device registry id, not a pile of entity ids. Entity
  lookups go through `hass.entities`/`translation_key`, so renaming entities never breaks the
  card, and missing entities (e.g. no `pump` on a Venty/Crafty) drive conditional rendering (no
  AIR toggle, no battery chip, etc).
- **Climate entity is the single source of truth for heat.** The HEAT toggle drives
  `climate.set_hvac_mode`, never a parallel heater switch.
- **Optimistic updates, debounced.** The ± stepper and dial drag update a pending target
  immediately and debounce ~500 ms before calling `climate.set_temperature`.
- **Pump safety is enforced server-side** by the integration's pump guard — the card only toggles
  the pump switch. The failsafe/cooldown *duration* dropdowns write to option-backed number
  entities, which reload the integration's config entry (a brief BLE reconnect) — the same
  mechanism the integration's own options flow uses.
- **No HA frontend imports.** Use the hand-rolled `hass` typings in `src/types.ts` and native
  elements (`<details>`, `<input type="range">`, `<select>`) styled with HA theme variables. Do
  not introduce `custom-card-helpers` or `home-assistant-frontend` as dependencies — the card
  stays a single self-contained bundle with only `lit`.
- **Self-registering subcomponents.** Each subcomponent module calls `customElements.define` for
  its own tag at the bottom of the file (guarded by `customElements.get`) — no central registry.
  Importing a subcomponent module directly is enough to register it.
- **No external fonts or charting libraries.** The seven-segment readout and both charts are
  hand-built with CSS and SVG — important for HA installs without outbound internet access.

## TypeScript standards

- Strict, explicit typing (`tsconfig.json` has `strict: true`, `noUncheckedIndexedAccess: true`);
  avoid `any` unless there is no practical alternative.
- Use `import type` for type-only imports where appropriate.
- Validate and narrow optional config fields before use.
- Keep public API names stable unless explicitly requested to change them.

## Lit and component guidance

- Use `@property` for public reactive inputs and `@state` for internal state.
- Avoid direct DOM mutation when Lit reactivity can handle updates.
- Preserve existing card/editor lifecycle behavior.
- For card config, validate early in `setConfig` and throw actionable errors.
- Keep `getCardSize` deterministic and aligned with rendered density.

## Styling and UX

- Respect Home Assistant theme variables and CSS custom properties.
- Avoid hardcoded colors when theme tokens can be used.
- The two-column layout (readout/dial/stepper/HEAT/AIR on the left; session/history/sessions/
  device-info panels on the right) reflows to a single column under a `@container` query for
  narrow dashboard slots — preserve this when touching layout code.

## Build and quality expectations

- Keep `bun run lint` clean for changed code (Biome — the TypeScript analogue of Ruff).
- Ensure `bun run check` (tsc) and `bun test` succeed after non-trivial changes.
- Do not introduce unrelated refactors in focused changes.
- The card has no i18n scaffold today (see `TODO.md`) — do not add user-facing string literals
  that would need one without discussing it first; HA already localizes entity names/states.

## Safe change workflow

1. Read adjacent code before editing.
2. Implement the smallest viable change.
3. Run relevant checks (`bun run lint`, `bun run check`, `bun test`, or `script/check` for all
   three).
4. Update docs/README when behavior or config changes.
5. Summarize what changed and why.

## Pull request guidance

- Keep PRs focused to one logical change.
- Include screenshots or short clips for visible UI/editor changes.
- Document config changes and migration notes when applicable.
- Call out any follow-up work explicitly instead of bundling extra scope.

## Avoid these common issues

- Breaking editor/card config parity
- Adding untyped dynamic config access
- Bypassing the entity-registry lookup in `entities.ts` with hardcoded entity ids
- Overriding theme behavior with fixed styles
- Changing the output filename (`storz-bickel-card.js`) or card tag without explicit request —
  both are referenced by `hacs.json`, the release workflow, and the integration's README
