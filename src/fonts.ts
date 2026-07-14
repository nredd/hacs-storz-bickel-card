/**
 * Runtime injection of the bundled fonts (see font-data.gen.ts).
 *
 * `@font-face` rules are inert inside shadow DOM, so the card cannot declare
 * its fonts in its own adopted stylesheet — they must live in a document-level
 * <style>. `ensureFonts()` injects one such element into `document.head`,
 * deduped by id so any number of cards/editors on a dashboard share it.
 */

import { FONT_STYLE_ID } from "./const";
import { FONT_FACES } from "./font-data.gen";

/** Inject the bundled @font-face rules into `doc`'s head (idempotent). */
export function ensureFonts(doc: Document = document): void {
  if (doc.getElementById(FONT_STYLE_ID)) {
    return;
  }
  const style = doc.createElement("style");
  style.id = FONT_STYLE_ID;
  style.textContent = FONT_FACES.map(
    (face) =>
      `@font-face{font-family:'${face.family}';font-style:normal;font-weight:${face.weight};` +
      `font-display:swap;src:url(data:font/woff2;base64,${face.data}) format('woff2');}`,
  ).join("\n");
  doc.head.appendChild(style);
}
