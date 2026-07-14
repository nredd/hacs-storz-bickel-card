#!/usr/bin/env bun
/**
 * script/generate-fonts.ts: Regenerate `src/font-data.gen.ts` from the
 * @fontsource packages in node_modules.
 *
 * The card bundles its fonts as base64 data URLs so it renders identically
 * offline and needs no external requests (Home Assistant dashboards often run
 * on LANs without internet). The generated file is committed; rerun this
 * script after bumping a @fontsource dependency.
 *
 * Usage:
 *   bun run script/generate-fonts.ts
 */

interface FontSpec {
  family: string;
  pkg: string;
  prefix: string;
  weights: number[];
}

/** Latin-subset woff2 faces matching the design prototype's font stack. */
const FONTS: FontSpec[] = [
  {
    family: "Inter",
    pkg: "@fontsource/inter",
    prefix: "inter",
    weights: [400, 500, 600, 700, 800],
  },
  {
    family: "JetBrains Mono",
    pkg: "@fontsource/jetbrains-mono",
    prefix: "jetbrains-mono",
    weights: [400, 500, 600, 700],
  },
  {
    family: "DSEG7 Classic",
    pkg: "@fontsource/dseg7-classic",
    prefix: "dseg7-classic",
    weights: [400],
  },
];

const OUT_PATH = new URL("../src/font-data.gen.ts", import.meta.url).pathname;
const ROOT = new URL("..", import.meta.url).pathname;

const faces: { family: string; weight: number; data: string }[] = [];
for (const font of FONTS) {
  for (const weight of font.weights) {
    const path = `${ROOT}node_modules/${font.pkg}/files/${font.prefix}-latin-${weight}-normal.woff2`;
    const file = Bun.file(path);
    if (!(await file.exists())) {
      console.error(`Missing font file: ${path} — run 'bun install' first.`);
      process.exit(1);
    }
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    faces.push({ family: font.family, weight, data });
  }
}

const entries = faces
  .map(
    (face) =>
      `  { family: ${JSON.stringify(face.family)}, weight: ${face.weight}, data:\n    ${JSON.stringify(face.data)} },`,
  )
  .join("\n");

const source = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Base64 woff2 payloads (latin subsets) bundled so the card renders
 * identically offline. Regenerate with: bun run script/generate-fonts.ts
 */

export interface EmbeddedFontFace {
  family: string;
  weight: number;
  /** Base64-encoded woff2 payload. */
  data: string;
}

export const FONT_FACES: EmbeddedFontFace[] = [
${entries}
];
`;

await Bun.write(OUT_PATH, source);
const kib = Math.round(source.length / 1024);
console.log(`Wrote ${OUT_PATH} (${faces.length} faces, ${kib} KiB)`);
