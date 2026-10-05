// PRD §20: CI fails if a Monad mainnet chain ID, CAIP-2 ID, chain import or
// mainnet USDC address is introduced anywhere in tracked source.
// A line can opt out with the marker `testnet-guard-ignore` (tests and this file only).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MAINNET_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Monad mainnet chain ID 143", pattern: /(?<![\w.])143(?![\w.])/ }, // testnet-guard-ignore
  { label: "Monad mainnet CAIP-2 ID", pattern: /eip155:143\b/ }, // testnet-guard-ignore
  { label: "viem mainnet `monad` chain import", pattern: /import\s*\{[^}]*\bmonad\b(?!Testnet)[^}]*\}\s*from\s*["']viem\/chains["']/ }, // testnet-guard-ignore
  { label: "Monad mainnet USDC address", pattern: /0x754704bc059f8c67012fed69bc8a327a5aafb603/i } // testnet-guard-ignore
];

const SCANNED_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json|ya?ml)$|(^|\/)\.env[^/]*$/;
const SKIPPED_FILES = new Set(["package-lock.json"]);
const IGNORE_MARKER = "testnet-guard-ignore";

export type Violation = { file: string; line: number; label: string; text: string };

export function findMainnetViolations(file: string, content: string): Violation[] {
  const violations: Violation[] = [];

  content.split("\n").forEach((text, index) => {
    if (text.includes(IGNORE_MARKER)) return;
    for (const { label, pattern } of MAINNET_PATTERNS) {
      if (pattern.test(text)) violations.push({ file, line: index + 1, label, text: text.trim() });
    }
  });

  return violations;
}

function trackedFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
  return output
    .split("\n")
    .filter((file) => file && SCANNED_EXTENSIONS.test(file) && !SKIPPED_FILES.has(file));
}

function main() {
  const violations = trackedFiles().flatMap((file) => findMainnetViolations(file, readFileSync(file, "utf8")));

  if (violations.length > 0) {
    for (const v of violations) console.error(`${v.file}:${v.line}  ${v.label}\n    ${v.text}`);
    console.error(`\nAuctra MVP is Monad Testnet only. ${violations.length} mainnet reference(s) found.`);
    process.exit(1);
  }

  console.log("Testnet-only check passed.");
}

if (process.argv[1]?.endsWith("check-testnet-only.ts")) {
  main();
}
