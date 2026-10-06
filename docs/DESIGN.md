# Auctra design system

How the web app looks and behaves. Product rules live in `docs/PRD.md`; this file only covers presentation.

## Principles

- **Ledger & Flare.** Warm paper, deep aubergine ink, a chartreuse signal for the primary action and success, and a vermilion flare for emphasis. It should never be mistaken for a blue-and-white fintech or a neon crypto dashboard.
- **Editorial, not terminal.** A soft serif (Fraunces) carries headlines and amounts; a clean grotesk (Instrument Sans) carries the product. Italic flare phrases mark the one idea a heading is about.
- **Say it, see it, confirm it.** Every money movement is shown as plain fields (amount, when, to, condition, network) before it exists.
- **State never relies on colour alone.** Every status has an icon and a word.
- **Mobile is designed, not shrunk.** Bottom navigation, bottom-sheet dialogs, stacked lists instead of tables.

## Tokens (`app/globals.css`, Tailwind `@theme`)

| Token | Value | Use |
|---|---|---|
| `obsidian` | `#1B1433` | Aubergine ink, dark bands, sidebar, focus ring |
| `signal` | `#C5F04A` | Chartreuse: primary buttons, success fills, marquee band |
| `signal-strong` | `#B2E02C` | Primary hover |
| `flare` | `#FF5C35` | Vermilion: emphasis, the logo dot, final CTA band, hard shadows on dark |
| `flare-text` | `#E4461E` | Flare used as text (the `accent-italic` utility) |
| `amber` | `#F5B83D` | Pending / warning / testnet fills and borders |
| `danger` | `#E5484D` | Failed / danger borders |
| `cloud` | `#F5EFE4` | Paper: page background, subtle panels |
| `surface` | `#FFFCF7` | Cards, dialogs |
| `slate` | `#675F73` | Secondary text, metadata, icons |
| `line` | `#E4D9C6` | Borders and dividers |
| `ink-2` | `#463F57` | Body text one step softer than obsidian |
| `signal-ink` / `-soft` | `#3E6B00` / `#EEF9CC` | Green **text** and its tint |
| `flare-ink` / `-soft` | `#B8360F` / `#FFE6DC` | Flare **text** on its tint |
| `amber-ink` / `-soft` | `#8A5A00` / `#FDF1DA` | Amber **text** and its tint |
| `danger-ink` / `-soft` | `#B42F2F` / `#FDEAEA` | Red **text** and its tint |
| `obsidian-2`, `obsidian-line` | `#261E42`, `#3B3259` | Hover and borders on dark bands |

Measured contrast: slate on surface 5.93, slate on cloud 5.30, cloud on obsidian 15.36, obsidian on signal 13.34, obsidian on flare 5.72, flare on obsidian 5.72, signal-ink on signal-soft 5.76, flare-ink on flare-soft 4.93, amber-ink on amber-soft 5.30, danger-ink on danger-soft 5.35, flare-text on cloud 3.53 (headline sizes only). Raw `flare` on paper is 2.68, so it is used only for decoration and large numerals, never body text.

Geometry: `--radius-control` pill (buttons), `--radius-input` 12px, `--radius-card` 18px, `--radius-surface` 24px (dialogs, sheets, feature cards). `--shadow-pop` is a hard 4px aubergine offset shadow used on marketing cards. Utilities: `accent-italic` (italic flare phrase), `bg-ledger` (faint ruled-paper lines), `bg-grain` (dot grain on dark bands). Spacing uses Tailwind's 4px scale.

## Typography

Fraunces (variable, soft and "wonky" axes on) for display, headings and amounts; Instrument Sans for product copy; JetBrains Mono for data (addresses, hashes, chain IDs). All self-hosted via `@fontsource-variable`.

| Utility | Size / line height | Role |
|---|---|---|
| `text-display` | Fraunces clamp(40→88px) / 0.98, 500 | Landing headline only |
| `text-h1` | Fraunces clamp(26→36px) / 1.1, 500 | Page heading |
| `text-h2` | 17px / 1.4, 600 | Section heading |
| `text-h3` | 15px / 1.4, 600 | Card heading |
| `text-body` | 15px / 1.6 | Body |
| `text-secondary` | 14px / 1.5, slate | Supporting copy |
| `text-meta` | 12px uppercase, 0.06em | Labels, eyebrows |
| `text-data` | JetBrains Mono 13px | Addresses, hashes |
| `text-amount` | Fraunces clamp(32→44px), tabular | Balance |

Fluid sizes use `clamp()` so phones don't get oversized headings.

## Brand assets

- Mark: a chartreuse "A" on an aubergine tile whose crossbar is a vermilion dot, the moment an automation fires. `components/auctra/logo.tsx`, `app/icon.svg` (favicon), `app/apple-icon.png` (180px touch icon), `public/brand/auctra-mark.svg` and `auctra-mark-512.png`.
- Lockups: `public/brand/auctra-lockup-dark.svg|png` (on aubergine) and `auctra-lockup-light.svg|png` (on paper).
- Social card: `app/opengraph-image.tsx` (1200×630).
- Marketing chrome: `SiteHeader` and `SiteFooter` in `components/auctra/site-chrome.tsx`, used by the landing, legal and 404 pages.

## Components

`components/ui/` holds the primitives:
- `Button` / `ButtonLink`: variants primary, secondary, ghost, danger, danger-ghost, dark and on-dark. They have loading states and are at least 40–48px tall.
- `Field` (label, hint and error wired with ids), `Input`, `Textarea`, `Select`.
- `Card` / `CardHeader` / `CardBody`.
- `Badge`, `TestnetBadge`, `StatusBadge`.
- `Dialog`: native `<dialog>`; a bottom sheet below 640px. `ConfirmDialog` replaces `window.confirm()`, which Telegram's in-app browser blocks.
- `Address`: shortened, with copy and explorer link, and the full value in a tooltip and for screen readers.
- `LoadingState`, `Skeleton`, `Spinner`, `EmptyState`, `ErrorState`, `Notice`.
- `icons`.

`components/auctra/` holds the product components:
- `AppShell`, `PageHeader`, `Logo`, `StatusScreen`, `SiteHeader`, `SiteFooter`, `LegalPage`.
- `ConfirmationCard`, `CreateAutomationDialog`, `AutomationCard`.
- `ExecutionList`: a table at 768px and up, a stacked list below.
- `WalletSummary`, `DestinationForm`.
- `Resource`: one loading → error → empty → content pattern.

## Statuses

| Shown as | Icon | Tone | From |
|---|---|---|---|
| Active | dot | green | automation `ACTIVE` |
| Paused | pause | amber | automation `PAUSED` |
| Pending | clock | amber | execution `PENDING`, `SUBMITTED` |
| Completed | check | green | execution `CONFIRMED`; automation `COMPLETED` (neutral) |
| Skipped | skip | amber | execution `SKIPPED` |
| Failed | × | red | execution `FAILED`, `REJECTED` |
| Needs review | alert | red | execution `UNKNOWN` |
| Cancelled | × | neutral | automation `CANCELLED` |

Reasons for skipped or failed runs come from the backend's error **code**, mapped to plain sentences in `lib/client/format.ts`. Raw backend messages are never shown.

## Layout and navigation

- **≥1024px:** a 248px sidebar with Overview, Automations, Activity, Settings, the Create automation button, the wallet and sign-out.
- **<1024px:** a sticky top bar (logo, testnet badge, Create) and a fixed bottom tab bar with 56px targets, respecting the iOS safe area.
- **Content:** at most 72rem wide. Cards go from one column to two from 768px, and three on the Automations page from 1536px.
- **Verified:** no horizontal scroll, clipping or undersized controls at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px, on every page and dialog state.

## Motion

Only 150–220ms transitions:
- button press (scale 0.98);
- card and confirmation entrance (fade and 4px rise);
- sheet entrance;
- spinners.

Everything is disabled under `prefers-reduced-motion`.
