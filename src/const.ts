/** Card-wide constants. */

/** Informational version printed to the console banner. */
export const CARD_VERSION = "0.1.0";

/** Custom element tag for the card. */
export const CARD_TAG = "storz-bickel-card";

/** Custom element tag for the visual config editor. */
export const EDITOR_TAG = "storz-bickel-card-editor";

/** Custom element tag for the temperature dial subcomponent. */
export const DIAL_TAG = "sb-temp-dial";

/** Custom element tag for the dual seven-segment temperature readout. */
export const SEVEN_SEGMENT_TAG = "sb-seven-segment";

/** Custom element tag for the temperature history line chart. */
export const HISTORY_CHART_TAG = "sb-history-chart";

/** Custom element tag for the sessions-per-day bar chart. */
export const SESSIONS_CHART_TAG = "sb-sessions-chart";

/** Integration domain whose entities the card binds to. */
export const INTEGRATION_DOMAIN = "storz_bickel";

/** Default preset temperatures offered by the stub config. */
export const DEFAULT_PRESETS = [175, 185, 195];
