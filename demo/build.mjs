// Builds the browser sandbox into demo/dist (page + bundle + PGlite assets).
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const out = resolve(here, "dist");
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [resolve(here, "sandbox.ts")],
  outfile: resolve(out, "sandbox.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  sourcemap: false,
  loader: { ".sql": "text" },
  define: { "process.env": "{}" },
  alias: {
    "node:crypto": resolve(here, "shims/crypto.ts"),
    "@anthropic-ai/sdk": resolve(here, "shims/anthropic.ts"),
    "@anthropic-ai/sdk/helpers/beta/zod": resolve(here, "shims/anthropic.ts")
  },
  logLevel: "warning"
});

const pglite = resolve(root, "node_modules/@electric-sql/pglite/dist");
copyFileSync(resolve(pglite, "pglite.wasm"), resolve(out, "pglite.wasm"));
// The artifact host serves no raw binary data files, so the filesystem bundle ships as base64 text.
writeFileSync(resolve(out, "pglite-data.txt"), readFileSync(resolve(pglite, "pglite.data")).toString("base64"));
writeFileSync(resolve(out, "index.html"), readFileSync(resolve(here, "sandbox.html"), "utf8"));
console.log("Built demo/dist");
