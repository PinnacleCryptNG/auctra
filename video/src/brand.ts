// Auctra tokens, copied from app/globals.css (docs/DESIGN.md).
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/jetbrains-mono";

export const C = {
  obsidian: "#1B1433",
  obsidian2: "#261E42",
  obsidianLine: "#3B3259",
  signal: "#C5F04A",
  signalStrong: "#B2E02C",
  signalInk: "#3E6B00",
  signalSoft: "#EEF9CC",
  cloud: "#F5EFE4",
  surface: "#FFFCF7",
  slate: "#675F73",
  line: "#E4D9C6",
  ink2: "#463F57",
  amber: "#F5B83D"
};

export const F = {
  sans: '"Instrument Sans Variable", sans-serif',
  display: '"Fraunces Variable", serif',
  mono: '"JetBrains Mono Variable", monospace'
};

/** Fraunces with the soft, slightly wonky axes the site uses for display type. */
export const displayAxes = { fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 144' } as const;

/** The chartreuse highlighter stroke behind an italic phrase (accent-italic). */
export const accentItalic = {
  fontStyle: "italic",
  fontVariationSettings: '"SOFT" 100, "WONK" 1',
  backgroundImage: `linear-gradient(to top, ${C.signal}B3 0 34%, transparent 34%)`,
  padding: "0 0.06em"
} as const;
