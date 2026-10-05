# Auctra design system

How the web app looks and behaves. Product rules live in `docs/PRD.md`; this file only covers presentation.

## Principles

- **A financial product, not a terminal.** Light, calm surfaces; obsidian ink; signal green reserved for the primary action and success.
- **Say it, see it, confirm it.** Every money movement is shown as plain fields (amount, when, to, condition, network) before it exists.
- **State never relies on colour alone.** Every status has an icon and a word.
- **Mobile is designed, not shrunk.** Bottom navigation, bottom-sheet dialogs, stacked lists instead of tables.

## Tokens (`app/globals.css`, Tailwind `@theme`)

| Token | Value | Use |
|---|---|---|
| `obsidian` | `#0B0D0F` | Text ink, dark hero/CTA bands, focus ring |
| `signal` | `#35D07F` | Primary buttons, success fills, active nav marker |
| `amber` | `#F2B84B` | Pending / warning / testnet fills and borders |
| `danger` | `#EF5B5B` | Failed / danger borders |
| `cloud` | `#F5F6F4` | App background, subtle panels |
| `slate` | `#667078` | Secondary text, metadata, icons |
| `line` | `#DCE1DE` | Borders and dividers |
| `surface` | `#FFFFFF` | Cards, dialogs |
| `ink-2` | `#3A4146` | Body text one step softer than obsidian |
| `signal-ink` / `-soft` | `#157A46` / `#E6F8EE` | Green **text** and its tint |
| `amber-ink` / `-soft` | `#8A5A00` / `#FDF4E2` | Amber **text** and its tint |
| `danger-ink` / `-soft` | `#B42F2F` / `#FDECEC` | Red **text** and its tint |
| `obsidian-2`, `obsidian-line` | `#15181B`, `#262B30` | Hover and borders on dark bands |

The `-ink` and `-soft` shades are darker and lighter versions of the same hues. The core colours used as text on white fail WCAG AA (signal ≈ 2:1), so text uses the `-ink` shades. Measured contrast: slate on white 5.06, slate on cloud 4.66, signal-ink on signal-soft 4.87, amber-ink on amber-soft 5.42, danger-ink on danger-soft 5.43, obsidian on signal 9.72.

Geometry: `--radius-control` 8px (buttons, small controls), `--radius-input` 10px, `--radius-card` 12px, `--radius-surface` 16px (dialogs, sheets). Badges are 6px, not pills. Spacing uses Tailwind's 4px scale, mainly 1, 2, 3, 4, 5, 6, 8, 10, 16.

## Typography

Inter for product copy and JetBrains Mono for data (addresses, hashes, chain IDs), both self-hosted via `@fontsource`.

| Utility | Size / line height | Role |
|---|---|---|
| `text-display` | clamp(34→64px) / 1.05, 600 | Landing headline only |
| `text-h1` | clamp(22→28px) / 1.2, 600 | Page heading |
| `text-h2` | 17px / 1.4, 600 | Section heading |
| `text-h3` | 15px / 1.4, 600 | Card heading |
| `text-body` | 15px / 1.6 | Body |
| `text-secondary` | 14px / 1.5, slate | Supporting copy |
| `text-meta` | 12px uppercase, 0.06em | Labels, eyebrows |
| `text-data` | JetBrains Mono 13px | Addresses, hashes |
| `text-amount` | clamp(32→44px), tabular | Balance |

Fluid sizes use `clamp()` so phones don't get oversized headings.

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
- `AppShell`, `PageHeader`, `Logo`, `StatusScreen`.
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
