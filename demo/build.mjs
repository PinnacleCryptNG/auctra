// Builds the browser sandbox into demo/dist: the real Auctra UI and services,
// bundled with Next/Privy stand-ins, plus PGlite and the compiled stylesheet.
import tailwind from "@tailwindcss/postcss";
import { build } from "esbuild";
import postcss from "postcss";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const out = resolve(here, "dist");
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [resolve(here, "sandbox/main.tsx")],
  outfile: resolve(out, "sandbox.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  jsx: "automatic",
  loader: { ".sql": "text" },
  tsconfig: resolve(root, "tsconfig.json"),
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_PRIVY_APP_ID": '"sandbox"',
    "process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME": "undefined",
    "process.env": "{}"
  },
  alias: {
    "node:crypto": resolve(here, "shims/crypto.ts"),
    "@anthropic-ai/sdk": resolve(here, "shims/anthropic.ts"),
    "@anthropic-ai/sdk/helpers/beta/zod": resolve(here, "shims/anthropic.ts"),
    "@privy-io/react-auth": resolve(here, "shims/privy.tsx"),
    "next/link": resolve(here, "shims/next-link.tsx"),
    "next/navigation": resolve(here, "shims/next-navigation.ts")
  },
  logOverride: { "unsupported-directive": "silent" },
  logLevel: "warning"
});

const cssEntry = resolve(here, "sandbox.css");
const css = await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(readFileSync(cssEntry, "utf8"), { from: cssEntry });
writeFileSync(resolve(out, "sandbox.css"), css.css);

const pglite = resolve(root, "node_modules/@electric-sql/pglite/dist");
copyFileSync(resolve(pglite, "pglite.wasm"), resolve(out, "pglite.wasm"));
// The artifact host serves no raw binary data files, so the filesystem bundle ships as base64 text.
writeFileSync(resolve(out, "pglite-data.txt"), readFileSync(resolve(pglite, "pglite.data")).toString("base64"));
writeFileSync(resolve(out, "index.html"), readFileSync(resolve(here, "sandbox.html"), "utf8"));
console.log("Built demo/dist");
