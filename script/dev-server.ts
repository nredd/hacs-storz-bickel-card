#!/usr/bin/env bun
/**
 * script/dev-server.ts: Minimal static file server for local card development.
 *
 * Serves `dist/` on port 5000, matching the `LOVELACE_REMOTE_FILES` URL the
 * devcontainer points Home Assistant's frontend at
 * (http://localhost:5000/storz-bickel-card.js). No dependency beyond Bun's
 * built-in `Bun.serve` — there's no Bun-native equivalent of
 * `rollup-plugin-serve`, and the project's toolchain philosophy keeps
 * dependencies limited to `lit`.
 *
 * Usage:
 *   bun run script/dev-server.ts
 *   bun run serve   # via package.json
 *
 * Pair with `bun run dev` (watch-mode build) for live reload during
 * development.
 */

const DIST_DIR = new URL("../dist/", import.meta.url).pathname;
const DEV_DIR = new URL("../dev/", import.meta.url).pathname;
// Default matches the devcontainer's LOVELACE_REMOTE_FILES URL; override with
// PORT= when 5000 is taken (macOS AirPlay Receiver squats on it).
const PORT = Number(process.env.PORT ?? 5000);

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/storz-bickel-card.js" : url.pathname;

    // Mock preview (dev only): the real card against a simulated device, for
    // side-by-side comparison with docs/design/vaporizer-card-final.dc.html.
    if (pathname === "/preview") {
      return new Response(Bun.file(`${DEV_DIR}preview.html`), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (pathname === "/preview.js") {
      const build = await Bun.build({
        entrypoints: [`${DEV_DIR}preview.ts`],
        target: "browser",
        format: "esm",
      });
      const artifact = build.outputs[0];
      if (!build.success || !artifact) {
        const logs = build.logs.map((log) => String(log)).join("\n");
        return new Response(`Preview build failed:\n${logs}`, { status: 500 });
      }
      return new Response(artifact, {
        headers: { "Content-Type": "text/javascript; charset=utf-8" },
      });
    }

    const file = Bun.file(`${DIST_DIR}${pathname.slice(1)}`);
    if (await file.exists()) {
      return new Response(file, {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Serving ${DIST_DIR} at http://localhost:${server.port}/`);
