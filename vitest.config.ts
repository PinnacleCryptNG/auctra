import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests: `npm test` (no network, no credentials).
// Real Privy integration tests: `npm run test:integration` (needs credentials; see tests/integration).
// Integration runs read credentials from .env.local (never committed). Values are
// loaded into the process only; nothing prints them.
if (process.env.AUCTRA_INTEGRATION && existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname),
      "server-only": resolve(__dirname, "tests/helpers/server-only.ts")
    }
  },
  test: {
    include: process.env.AUCTRA_INTEGRATION ? ["tests/integration/**/*.test.ts"] : ["tests/**/*.test.ts"],
    exclude: process.env.AUCTRA_INTEGRATION ? [] : ["tests/integration/**", "node_modules/**"],
    testTimeout: 30_000
  }
});
