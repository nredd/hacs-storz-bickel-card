# Design source of truth

`vaporizer-card-final.dc.html` is the Claude Design prototype this card is a
pixel-identical port of (vendored verbatim; do not edit). When the design is
revised, regenerate the `.dc.html`, re-vendor it here, and re-apply the diff to
the code using the mapping below — every prototype section corresponds to one
render method or view-model function, so design diffs map mechanically onto
code diffs.

**Intentional deviations from the prototype (the only ones):**

- The decorative 72px "HA" sidebar strip (lines 29–33) is dropped; the design
  width is therefore **1328px** (1400 − 72), see `DESIGN_WIDTH` in
  `src/const.ts`.
- Mock data (demo history/session generators, hardcoded device info) is
  replaced by real Home Assistant data; missing entities render em-dashes /
  `---` in the *same DOM slots* so the layout never shifts.
- Label renames (user-directed): "Auto shutoff" → **Heater timeout**,
  "Pump failsafe" → **Pump timeout**, "Temp step" → **Temperature increment**,
  and the stepper caption "N° STEP" → **"N° INCREMENT"**. Styling unchanged.
- Live chart sampling: the prototype's index-based x mapping and stride
  downsample assumed uniform 1 Hz demo data. The card instead aggregates into
  fixed absolute-time buckets (mean), maps x by timestamp, extends the trace
  flat to "now", and holds the y-axis until data exits its bounds — same
  styling, smoother motion against irregular real history.
- The live dot gains `transition: top 1s linear` (invisible in the static
  design; glides instead of stepping between samples).
- Session timer semantics: the timer derives from the integration's
  `current_session_start`, whose SessionTracker keeps a session open across
  heater-off gaps under a 15-minute grace period — the timer intentionally
  does not reset on quick HEAT toggles (the prototype's demo reset it).

## Template mapping (prototype → `src/storz-bickel-card.ts`)

| Prototype lines | Section | Render method |
|---|---|---|
| 28 | Card shell (dark `#15130f` rounded box) | `render()` |
| 29–33 | "HA" sidebar strip | *dropped by design decision* |
| 35 | Main column wrapper | `render()` |
| 36–53 | Header: kicker/title, heat LEDs, online pill | `renderHeader()` |
| 55 | Two-column grid `560px 1fr` | `render()` |
| 56 | Left panel shell | `render()` |
| 57–73 | DSEG7 LCD + °F/°C toggle + status label | `renderLcd()` |
| 75–89 | Temperature knob + tick marks | `renderKnob()` |
| 91–98 | − / target input / + stepper pill | `renderStepper()` |
| 100–109 | HEAT / AIR buttons (embers, wind streaks) | `renderHeatAir()` |
| 112 | Right column wrapper | `render()` |
| 113–121 | Session timer + sessions today | `renderSessionPanel()` |
| 123–159 | Live temperature chart | `renderTempChart()` |
| 161–188 | Session bars chart | `renderSessionsChart()` |
| 190–210 | Device info + selects | `renderDeviceInfo()` |

## Logic mapping (prototype script → source files)

| Prototype lines | Logic | Ported to |
|---|---|---|
| 15–25 | `<helmet>` CSS: keyframes `pulseGlow`/`windDrift`/`airBreathe`/`emberRise`, `.hover-lift`, `.tick` | `src/styles.ts` |
| 217 | `data-props` (airEffect, windIntensity, idleBreeze, heatEffect, emberIntensity) | `CardConfig` in `src/types.ts` + `src/editor.ts` |
| 229–243 | 1 Hz heat/session simulator | `dev/preview.ts` (MockHass; dev only) |
| 246–269 | `seedHistory()` demo backlog | `dev/preview.ts` (dev only) |
| 274–290 | toggleHeat / togglePump / nudgeTarget / setUnit / commitTarget | card interaction handlers in `src/storz-bickel-card.ts` |
| 292–330 | Knob drag (angle math, clamping) | `src/storz-bickel-card.ts` drag handlers + `src/view-model.ts` |
| 332–338 | `formatTime` / `toDisplayTemp` | `src/format.ts` |
| 340–352 | `niceAxis` | `src/format.ts` |
| 354–370 | `smoothPath` | `src/format.ts` |
| 372–439 | `renderVals()`: progress, ember/wind generators, HEAT/AIR button styles | `src/view-model.ts` |
| 441–443 | Unit toggle styles | `src/view-model.ts` |
| 445–491 | Knob rotation, tick marks, knob styles | `src/view-model.ts` |
| 493–502 | LED styles, small pump button style | `src/view-model.ts` |
| 504–535 | Session bars (demo generator → real bucketing) | shape in `src/view-model.ts`; data from `src/sessions.ts` |
| 537–568 | Live chart: window slice, downsample, axis, paths, live dot | slice/downsample in `src/history.ts`; styles/paths in `src/view-model.ts` |
| 567–574 | Chart / session X-axis tick labels | `src/view-model.ts` |
| 576–585 | LCD target line/ghost/digit styles | `src/view-model.ts` |
| 587–639 | `v` assembly: display strings, options, field style, handlers | `src/view-model.ts` (values/styles) + card (handlers) |

## Transcription conventions

- Static `style="…"` attributes are copied **verbatim** as string literals.
- `{{v.xStyle}}` dynamic styles → the view model returns Lit `StyleInfo`
  objects rendered with `styleMap()` (same inline CSS output as React).
- `<sc-for list="{{v.xs}}" as="x">` → `xs.map((x) => html\`…\`)`.
- `ref="{{v.knobRef}}"` → `lit/directives/ref.js`.
- Mock state (`s.temp`, `s.target`, …) → view-model inputs sourced from
  `hass` via `src/entities.ts`.
