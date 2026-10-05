# Implementation change log

Every change to the product spec or a deliberate implementation decision, for review.
Each entry says **what** changed, **why**, and **where**. PRD sections refer to `docs/PRD.md`.

Status legend: **Spec** = PRD changed · **Decision** = implementation choice within the PRD · **Deviation** = differs from the uploaded v2.0 PRD.

---

## Round 1: PRD v2.1 + spike (earlier commit)

See the v2.1 changelog at the top of `docs/PRD.md`. Summary: session signers + authorization key, Privy Policy Engine, the onboarding web step, saved destinations, timezones, condition semantics, the execution state machine, Vercel Cron details, the pinned USDC contract, no edit in the MVP, the spike first.

## Round 2: businesses in the ICP + MVP build

### Product / spec

| # | Type | Change | Why | Where |
|---|---|---|---|---|
| 2.1 | Spec | Businesses added to the target users next to individuals (PRD v2.2). | Requested. | PRD §4 |
| 2.2 | Spec | New **account** entity (`INDIVIDUAL` / `BUSINESS`, business name). Wallets, destinations and automations belong to the account, not the user. | A business is not a person. Keeping a separate account boundary means multi-member businesses can be added later without migrating every table. | PRD §6, §9, §18; `db/schema.ts` |
| 2.3 | Spec | Business use cases: vendor payments, contractor payouts, reserve sweeps, operating floor. All of them use the existing transfer + condition model, so no new execution types. | Serve businesses without widening the execution surface. | PRD §5 |
| 2.4 | Spec | Destination **category** and automation **memo**. | Businesses need to know what a payment was for. Individuals benefit too. | PRD §9, §18 |
| 2.5 | Spec | CSV export of execution history. | Bookkeeping for businesses; the smallest useful accounting feature. | PRD §12, §19 |
| 2.6 | Spec | Multi-member accounts, roles, approvals, batch payouts, KYB, invoicing and accounting integrations are explicitly **out of scope**. | Keeps the hackathon MVP buildable. Logged so the business story is honest about what's missing. | PRD §24, §25 |

### Implementation decisions

| # | Type | Change | Why | Where |
|---|---|---|---|---|
| 2.7 | Deviation | The v2.0 intent schema allowed `ONCE` with no date. `ONCE` now requires `date` (YYYY-MM-DD). | A one-time run can't be scheduled without a date. | `lib/automation-types.ts` |
| 2.8 | Decision | At most one condition per automation (`MIN_BALANCE`). | The PRD lists only minimum balance; one is enough for every MVP use case. | `lib/financial-intent.ts` |
| 2.9 | Decision | Added `luxon` for timezone/DST math. | `Intl` alone can't safely resolve DST gaps and overlaps. Rules are tested in `tests/schedule.test.ts`. | `lib/schedule.ts` |
| 2.10 | Decision | Neon HTTP driver, with no interactive transactions. Atomic steps use single conditional statements (`INSERT … ON CONFLICT DO NOTHING`, `UPDATE … WHERE status IN (…) RETURNING`). | Works on Vercel serverless without WebSockets. The state machine never depends on a multi-statement transaction. | `db/client.ts`, `lib/services/*` |
| 2.11 | Decision | Tests run on PGlite (in-memory Postgres) with the real generated migration. | Tests the actual SQL constraints (unique execution key, chain check, business name) without a server. | `tests/helpers/db.ts` |
| 2.12 | Decision | The initial migration was regenerated while building. | No database has applied it yet. Future schema changes must be new migrations. | `drizzle/0000_init.sql` |
| 2.13 | Decision | `users.telegram_id` is nullable. | A user record is created from Telegram first, but the column shouldn't block a web-first user later. | `db/schema.ts` |
| 2.14 | Decision | Telegram → Privy linking uses a single-use token, valid for 30 minutes, created by `/start`. Only its SHA-256 hash is stored. | Deterministic linking, whatever login method the user picks in Privy. | `link_tokens`, `lib/services/accounts.ts` |
| 2.15 | Decision | One account per user and one execution wallet per account (unique constraints). | MVP simplicity; both are relaxed by later migrations when teams arrive. | `db/schema.ts` |
| 2.16 | Decision | Destination label lookup ignores case, extra spaces and a leading "my/our/the". | "my savings wallet" should find "Savings wallet". This lookup is deterministic; the LLM does not resolve labels. | `lib/services/destinations.ts` |
| 2.17 | Decision | Archiving a destination cancels every automation that pays it. Unique name/address indexes ignore archived rows. | An automation must never point at a removed destination, and a name can be reused. | `archiveDestination`, partial indexes |
| 2.18 | Decision | Confirmations expire after 10 minutes, are single-use, are bound to the user and kind, and are checked against their SHA-256 payload hash. | PRD §11. | `lib/services/confirmations.ts` |
| 2.19 | Deviation | A stale `PENDING` row (older than 5 minutes, no tx hash) becomes `UNKNOWN` and is **not** auto-resubmitted. v2.1 allowed a resubmit within Privy's idempotency window. | The window isn't verified (PRD §29 Q3). Not re-sending is the fail-closed choice. | PRD §10, `reconcileExecutions` |
| 2.20 | Decision | Preflight errors (e.g. RPC down) → `SKIPPED` / `PREFLIGHT_ERROR`. | Nothing was sent, so the outcome is known. | `processExecution` |
| 2.21 | Deviation | Earlier missed occurrences are counted in one audit event, not one `SKIPPED` row each. | Avoids flooding history (and notifications) after a long outage. | PRD §10, `runDueAutomation` |
| 2.22 | Decision | The daily cap counts `PENDING`, `SUBMITTED`, `CONFIRMED` and `UNKNOWN` executions in the last 24 hours. | `UNKNOWN` may have moved money, so it's counted to be safe. | `rolling24hSpend` |
| 2.23 | Decision | A `SUBMITTED` row with no receipt after 1 hour → `UNKNOWN`. | So nothing stays in flight forever. | `reconcileExecutions` |
| 2.24 | Decision | The scheduler reserves the execution row **before** advancing `next_run_at`. A crash in between can't lose a run or execute it twice. One automation's error doesn't stop the pass. | Exactly-once under crashes and concurrent cron runs (tested). | `runDueAutomation` |
| 2.25 | Decision | Executions snapshot the amount and destination address. | History stays accurate after a destination is archived. | `executions` table |
| 2.26 | Decision | `@anthropic-ai/sdk` upgraded 0.68 → 0.131. The parser uses `claude-opus-5-5` with structured outputs (`beta.messages.parse` + `betaZodOutputFormat`) at effort `low`, and server-side refusal fallback (`fallbacks: "default"`). The model can be overridden with `ANTHROPIC_MODEL`. | Current model and SDK. Structured outputs guarantee schema-shaped JSON. The fallback means a false-positive refusal reroutes instead of failing. | `lib/ai/intent-parser.ts` |
| 2.27 | Decision | Claude only *extracts* fields (null when unstated). Deterministic code builds the `FinancialIntent` and asks a clarifying question for anything missing (amount, recipient, frequency, **time**, day, date). It never defaults a value. | PRD §7.3 "never guess". A missing time is asked about rather than defaulted to 09:00. | `toFinancialIntent` |
| 2.28 | Decision | A destination address from the model is accepted only if it appears verbatim in the user's message. Model output is re-validated with Zod on our side. | Defends against hallucinated addresses. LLM output is untrusted input. | `parseIntent` |
| 2.29 | Decision | Batch payouts ("pay these 12 people") are classified UNSUPPORTED. | Out of scope (PRD v2.2 §24). | `SYSTEM_PROMPT` |
| 2.30 | Decision | Telegram clarifications are stored on the user (`pending_request`, 10 minutes). The answer is appended to the original request before re-parsing. | So "every Friday" → "what time?" → "6 PM" works without the user retyping. New migration `0001`. | `lib/telegram/bot.ts`, `drizzle/0001_pending_request.sql` |
| 2.31 | Decision | Added a `/run` command (a Run Now picker) to Telegram. The request id is derived from the message + automation, so a double tap is idempotent. | The demo needs Run Now; PRD §11 allows buttons for high-value actions. | `lib/telegram/bot.ts` |
| 2.32 | Decision | Destinations can be added in Telegram with `/destinations add <0xaddress> <name> [as <category>]`, followed by a confirm button. | Deterministic syntax; the LLM is not involved in saving addresses. | `lib/telegram/bot.ts` |
| 2.33 | Decision | "Never let my wallet fall below X" is recognised (`SET_BALANCE_FLOOR`) and sets the wallet floor after a confirm button. It never creates a transfer. | Balance protection is a PRD MVP use case; before this it was only settable in the dashboard. | `lib/ai/intent-parser.ts`, `lib/telegram/bot.ts` |
| 2.34 | Deviation | Onboarding requires saving one destination **before** granting the signer. | The Privy policy is an allowlist of destinations. An empty-allowlist policy is unverified, so we don't create one. | PRD §6, `syncTransferPolicy` |
| 2.35 | Decision | The Privy policy is owned by Auctra's key quorum (`PRIVY_SIGNER_ID`), so the server can update the allowlist when destinations change. The signer grant is verified server-side by reading the wallet's `additional_signers` from Privy, including that our policy is attached. | Never trust the browser's claim that permission was granted. | `app/api/onboarding/signer`, `lib/app/runtime.ts` |
| 2.36 | Decision | The execution wallet is discovered server-side (`wallets().list({ user_id })`) from the verified Privy access token. The browser never submits a wallet id or address. | Stops a client from registering someone else's wallet. | `app/api/onboarding/wallet` |
| 2.37 | Decision | Removing the **last** destination keeps the old Privy policy (it can't be emptied). Its automations are cancelled and the app's Layer 1 checks block sends. | Limitation of the allowlist approach; documented rather than hidden. | `app/api/destinations/[id]` |
| 2.38 | Decision | A provider rejection (`PROVIDER_REJECTED`, nothing sent) is any Privy HTTP 400/401/403/422. Timeouts and 5xx are treated as unknown outcomes. | Fail closed; never assume a 5xx means "not sent". | `isProviderRejection` |
| 2.39 | Decision | Every dashboard API call is authenticated with a Privy access token (`verifyAccessToken`). Cron uses `Authorization: Bearer $CRON_SECRET` and the Telegram webhook uses the secret-token header, both compared in constant time. | PRD §10/§11. | `lib/app/http.ts`, routes |
| 2.40 | Decision | The CSV export quotes every cell and neutralises leading `= + - @` (spreadsheet formula injection). | Memos and labels are user text. | `app/api/executions` |
| 2.41 | Deviation | Plain Tailwind components instead of shadcn/ui. | Same look with less generated code; brand tokens from PRD §14 live in `app/globals.css`. Fonts are self-hosted via `@fontsource` (Inter, JetBrains Mono). | `components/ui.tsx` |
| 2.42 | Decision | `vercel.json` schedules the cron **every minute**, which needs Vercel Pro. On Hobby, change it to daily and use Run Now for demos (PRD §10). | Correct behaviour by default; the limitation is documented in the README. | `vercel.json` |
| 2.43 | Decision | Installed `@stripe/stripe-js@^1.46` explicitly. | Required by Privy's `@stripe/crypto` dependency. `.npmrc` `legacy-peer-deps` stops npm installing peers automatically, and the build failed without it. | `package.json` |
| 2.44 | Decision | `npm run lint` runs `next typegen` before `tsc`, and CI also runs `next build`. Next 16 updated `tsconfig.json` (`jsx: react-jsx`). | Typed routes on a fresh checkout; CI catches build failures. | `package.json`, CI |

### Not built / not verified (honest status)

- **Nothing has run against live Privy, Monad Testnet, Telegram or the Claude API** from this environment: outbound access to them is blocked here, and no credentials are configured. Every external call is behind an interface and covered by tests with fakes. The live paths are verified by `docs/spike.md` and the PRD §29 questions.
- **Privy specifics still to verify live:** the calldata field names in the policy (`transfer.recipient`, `transfer.amount`), CAIP-2 `eip155:10143` support, the idempotency window, and Telegram login inside a Mini App.
- **No Playwright E2E tests yet.** Pages were checked with a production build, a smoke test, and screenshots of the landing page.
- **No multi-member business accounts, approvals or batch payouts** (out of scope, PRD v2.2 §24).

## Round 3: browser sandbox (for trying the product)

| # | Type | Change | Why | Where |
|---|---|---|---|---|
| 3.1 | Decision | Added a browser sandbox. It runs the **real** bot, services, scheduler, validation and migrations on PGlite (Postgres in WebAssembly). Only the edges are simulated: Privy (a wallet pre-created with permission granted), the Monad chain (transfers move a local balance; hashes are random and not on chain), the clock (a "jump to next run" button), and Telegram's transport. Built with `npm run demo:build`; the output in `demo/dist` is not committed. | To try the product before Privy, Neon, Telegram and Vercel are configured, without a separate mock implementation. | `demo/` |
| 3.2 | Decision | In the sandbox, plain-English parsing uses Claude through the claude.ai artifact runtime (the viewer's own account, quick tier), with the same system prompt and the same Zod validation as production. Without it, only the example requests work, using pre-recorded parses, and the page says so. | The production parser calls the Anthropic API with a server key, which a static page can't hold. | `demo/sandbox.ts` |
| 3.3 | Decision | Browser shims replace `node:crypto` (SHA-256 via `@noble/hashes`, random bytes via Web Crypto) and stub the Anthropic SDK. The PGlite filesystem bundle ships as base64 text. | Browser build; the artifact host serves no raw binary data files. | `demo/shims`, `demo/build.mjs` |

## Round 4: UI/UX and responsive revamp

Presentation only. No changes to the architecture, the execution model, the database model, Privy, Claude, the chain (Monad Testnet, 10143) or the asset (USDC). The design system is documented in `docs/DESIGN.md`.

| # | Type | Change | Why | Where |
|---|---|---|---|---|
| 4.1 | Decision | The app moved from an all-dark theme to light surfaces (cloud background, white cards, `#DCE1DE` lines, obsidian ink). Obsidian is used for the landing hero and CTA bands. | The brief asks for an institutional fintech feel; the PRD's border token only works on light surfaces. | `app/globals.css` |
| 4.2 | Decision | Added `-ink` (darker) and `-soft` (tint) shades of signal, amber and danger for text and badges. | Signal green, amber and red fail WCAG AA as text on light backgrounds. Same hues; no new colours. | `app/globals.css` |
| 4.3 | Decision | The one-page dashboard was split into Overview, Automations, Activity and Settings, with a desktop sidebar and a mobile bottom tab bar. Saved destinations moved to Settings. | Navigation and information hierarchy (brief). | `app/dashboard/**`, `components/auctra/app-shell.tsx` |
| 4.4 | Spec-neutral backend addition | `prepareAutomation` also returns a structured `preview` (amount, destination, schedule, timezone, first run, condition, floor, memo, network, chain, wallet). The `summary` string and Telegram are unchanged. | The confirmation must be shown as fields, not text. Parsing the summary string in the UI would be fragile. Additive and tested. | `lib/services/automations.ts`, `tests/services.test.ts` |
| 4.5 | Decision | Creating an automation is a dialog (bottom sheet on phones): compose → "Understanding your request…" → structured confirmation with Confirm / Edit → success. Clarifications, unsupported requests, unknown addresses (save inline, then re-read) and balance-floor requests each have their own state. | The core experience (brief). | `components/auctra/create-automation.tsx` |
| 4.6 | Decision | `window.confirm()` was replaced with in-app confirm dialogs for Run now, Cancel, Remove destination and Revoke permission. Run now now asks for confirmation. | Telegram's Mini App webview blocks native dialogs. Run now moves money immediately. | `ConfirmDialog` |
| 4.7 | Decision | Users never see raw backend errors. Execution reasons are mapped from error **codes** to plain sentences. API failures map to network / session / server copy; validation messages (written for users) are kept. | Error-state requirements (brief). | `lib/client/format.ts`, `friendlyError` |
| 4.8 | Fix | `useApi` keeps Privy's `getAccessToken` in a ref, so `request` is stable. Before, a changing function identity caused an infinite re-render loop. | Found in the responsive pass. | `lib/client/api.ts` |
| 4.9 | Decision | Account data is loaded once by an `AuctraDataProvider` shared by all dashboard pages. | Instant tab switches and consistent state. | `lib/client/auctra-data.tsx` |
| 4.10 | Decision | Execution history is a table from 768px and a stacked list below. Transaction hashes are shortened, with copy and explorer links. | No tiny columns on phones (brief). | `components/auctra/execution-list.tsx` |
| 4.11 | Decision | The landing page uses the real `ConfirmationCard` as its hero visual, plus "How it works", individuals and businesses, and security sections. | Show the product, not generic AI graphics (brief). | `app/page.tsx` |
| 4.12 | Decision | The Privy login modal uses the light theme. | Matches the app. | `app/providers.tsx` |
| 4.13 | Removed | `components/ui.tsx` and `components/add-destination.tsx`. | Replaced by `components/ui/*` and `DestinationForm`. | — |

## Round 5: sandbox runs the revamped UI

| # | Type | Change | Why | Where |
|---|---|---|---|---|
| 5.1 | Decision | The sandbox now bundles the real pages and components from `app/` and `components/` (landing, onboarding, Overview, Automations, Activity, Settings). Small stand-ins replace `next/link`, `next/navigation` (in-memory router) and Privy (signed in, wallet already exists). The stand-ins live only in `demo/shims`; the app code is unchanged. | The sandbox should show exactly the UI that ships. | `demo/sandbox/app.tsx`, `demo/shims/*` |
| 5.2 | Decision | The dashboard's `fetch("/api/...")` calls are answered in the page by the real services on PGlite, using the same request/response contract as `app/api/**`. CSV export and explorer links are disabled, because simulated transactions aren't on chain and the artifact frame blocks downloads. | Real behaviour without a server. | `demo/sandbox/engine.ts` (`handleApi`) |
| 5.3 | Decision | A "Sandbox" panel holds the simulated controls (Personal/Business, jump to the next scheduled run, add test USDC) and the Telegram bot chat, which shares the same account as the dashboard. | Shows both product surfaces working on one state. | `demo/sandbox/app.tsx` |
| 5.4 | Decision | The stylesheet is compiled with Tailwind from `app/globals.css`, so the sandbox uses the same design tokens. | One design system. | `demo/sandbox.css`, `demo/build.mjs` |
