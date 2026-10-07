// Renders review stills of every scene from one bundle: node review.mjs Landscape 0,130,200 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const [id = "Landscape", list = ""] = process.argv.slice(2);
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id, browserExecutable });
for (const f of list.split(",").map(Number)) {
  const output = `review/${id[0]}-${String(f).padStart(4, "0")}.png`;
  await renderStill({ serveUrl, composition, frame: f, output, browserExecutable, scale: 0.5 });
  console.log(output);
}
