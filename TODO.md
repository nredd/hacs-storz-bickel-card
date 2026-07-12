# TODO

- **Localization scaffold.** The upstream `boilerplate-card` template this repo started from
  included a `src/localize/` i18n scaffold (`localize.ts` + `languages/*.json`). It was dropped
  when porting the real `storz-bickel-card` source, which has no translation strings yet. If the
  card grows user-facing strings beyond entity names/states (which HA already localizes), revisit
  adding a small i18n layer at that point rather than carrying unused scaffolding.
