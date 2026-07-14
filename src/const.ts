/** Card-wide constants. */

/** Informational version printed to the console banner. */
export const CARD_VERSION = "0.1.0";

/** Custom element tag for the card. */
export const CARD_TAG = "storz-bickel-card";

/** Custom element tag for the visual config editor. */
export const EDITOR_TAG = "storz-bickel-card-editor";

/** Integration domain whose entities the card binds to. */
export const INTEGRATION_DOMAIN = "storz_bickel";

/** id of the @font-face <style> injected into document.head (dedupe key). */
export const FONT_STYLE_ID = "storz-bickel-card-fonts";

/**
 * Fixed internal layout width, px: the design prototype's 1400px shell minus
 * its 72px decorative sidebar. The card always lays out at this width and is
 * scaled uniformly (transform: scale) to fit its container.
 */
export const DESIGN_WIDTH = 1328;
