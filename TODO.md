# TODO

- **Confirm `columns: "full"` on older HA.** `getGridOptions()` returns `{ columns: "full" }`,
  supported in sections view since HA 2024.11. If older HA versions must be supported, detect and
  fall back to `{ columns: 24 }`.
- **Shell drop-shadow under the scale viewport.** The prototype shell's
  `box-shadow: 0 40px 90px …` is clipped by the scale viewport's `overflow: hidden` (the shadow
  falls entirely outside the stage). On a dashboard the card sits flush in a grid so this is
  likely fine; if the floating look is wanted, move the shadow to `.scale-viewport`.
- **Heater timeout "Off" option.** The prototype's (auto-shutoff, now "Heater timeout") select
  had an `Off` choice; the card currently offers only minute values. Check whether the
  integration's `auto_shutoff_minutes` number (or the separate `auto_shutoff_enabled` switch)
  should be wired to an Off row.
- **`current_session_duration` sensor pairing.** The card discovers the integration's
  `current_session_duration` sensor (added alongside this change in `hacs-storz-bickel`); on
  older integration versions the entity is simply absent and the card degrades silently. The
  session timer display always ticks client-side from `current_session_start`.

- **Localization scaffold.** The upstream `boilerplate-card` template this repo started from
  included a `src/localize/` i18n scaffold (`localize.ts` + `languages/*.json`). It was dropped
  when porting the real `storz-bickel-card` source, which has no translation strings yet. If the
  card grows user-facing strings beyond entity names/states (which HA already localizes), revisit
  adding a small i18n layer at that point rather than carrying unused scaffolding.
