import { describe, expect, it } from "bun:test";
import { FONT_STYLE_ID } from "../src/const";
import { FONT_FACES } from "../src/font-data.gen";
import { ensureFonts } from "../src/fonts";

describe("font-data.gen", () => {
  it("bundles the design prototype's font stack", () => {
    const weights = (family: string) =>
      FONT_FACES.filter((face) => face.family === family)
        .map((face) => face.weight)
        .sort((a, b) => a - b);
    expect(weights("Inter")).toEqual([400, 500, 600, 700, 800]);
    expect(weights("JetBrains Mono")).toEqual([400, 500, 600, 700]);
    expect(weights("DSEG7 Classic")).toEqual([400]);
  });

  it("holds base64 payloads", () => {
    for (const face of FONT_FACES) {
      expect(face.data.length).toBeGreaterThan(1000);
      expect(face.data).toMatch(/^[A-Za-z0-9+/=]+$/);
    }
  });
});

describe("ensureFonts", () => {
  it("injects one style element with an @font-face per bundled face", () => {
    document.getElementById(FONT_STYLE_ID)?.remove();
    ensureFonts();
    const style = document.getElementById(FONT_STYLE_ID);
    expect(style).not.toBeNull();
    const css = style?.textContent ?? "";
    expect(css.match(/@font-face/g)?.length).toBe(FONT_FACES.length);
    expect(css).toContain("font-family:'DSEG7 Classic'");
    expect(css).toContain("data:font/woff2;base64,");
  });

  it("is idempotent", () => {
    document.getElementById(FONT_STYLE_ID)?.remove();
    ensureFonts();
    ensureFonts();
    expect(document.querySelectorAll(`#${FONT_STYLE_ID}`).length).toBe(1);
  });
});
