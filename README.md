<p align="center">
  <img src="public/brand/auctra-lockup-light.png" alt="Auctra" width="320" />
</p>

<h3 align="center">Money that moves itself.</h3>

<p align="center">
  Tell Auctra what your money should do, in one sentence. It confirms the details, then pays, saves and sweeps USDC on schedule, inside limits only you can change.
</p>

<p align="center">
  <a href="https://auctra-fp4i.vercel.app"><b>Live app</b></a> ·
  <a href="https://t.me/AuctraBot"><b>Telegram bot</b></a> ·
  <a href="#try-it-in-3-minutes">Try it</a> ·
  <a href="docs/PRD.md">Product spec</a> ·
  <a href="docs/DESIGN.md">Design system</a>
</p>

<p align="center">
  <b>Monad Metropolis Hackathon</b> · <b>Track 02: Consumer Products & Payments</b> · Runs on <b>Monad Testnet</b> (chain 10143) with test USDC
</p>

<p align="center">
  <b>Demo video:</b> link coming soon · <b>License:</b> <a href="LICENSE">MIT</a>
</p>

---

## In one line

Auctra is an AI money agent you talk to in Telegram or on the web. You say what your money should do, it shows you the exact transfer, and after you confirm it runs on schedule from your own wallet on Monad, without ever holding your keys.

## Try it in 3 minutes

1. Open [@AuctraBot](https://t.me/AuctraBot) in Telegram and send `/start`, or sign in to the [live app](https://auctra-fp4i.vercel.app) with email.
2. Pick **Personal** or **Business**. Auctra creates your wallet and asks you to approve its spending limits.
3. Get test funds: MON for fees from the [Monad faucet](https://faucet.monad.xyz) and test USDC from [Circle's faucet](https://faucet.circle.com) (choose Monad Testnet).
4. Save a destination, for example any address named **Savings**.
5. Type: *"Save 20 USDC to my savings wallet every Friday at 6 PM."*
6. Check the summary and tap **Confirm**.
7. Open the automation and press **Run now** to see it send right away. The receipt links to the transaction on the Monad Testnet explorer.

In Telegram, `/balance`, `/automations`, `/destinations` and `/history` show the same data as the dashboard.

## The problem

Recurring money tasks are easy to describe and tedious to do: save every Friday, pay rent on the 1st, pay a contractor weekly, keep a reserve topped up. Crypto wallets make you click through every one of them by hand, and AI agents that could do it usually ask for your keys.

## What Auctra does

1. **Understands it.** Claude extracts the amount, recipient, schedule and any condition. Nothing else.
2. **Shows it back.** You see the exact transfer as plain fields and tap **Confirm**. Nothing runs before that.
3. **Runs it.** On schedule, Auctra checks your balance and limits, sends the USDC from your own wallet, and messages you a receipt.

It works for people (savings, rent, balance floors) and for small businesses (vendors, contractors, reserve sweeps, memos and CSV export).

Example requests it understands:

- *Save 20 USDC to my savings wallet every Friday at 6 PM*
- *Pay Acme Hosting 80 USDC on the 1st of every month at 09:00, memo INV hosting*
- *Send 50 USDC to my reserve every Monday at 10:00 only if my balance is at least 500*

## Why Monad

- **Small, frequent transfers need cheap, fast blocks.** A weekly 20 USDC saving only makes sense when fees are tiny and the receipt arrives in seconds. Monad gives both.
- **It's EVM.** Standard USDC, viem and Privy's embedded wallets work as they are, with no custom contracts needed.
- **Every run is verifiable.** Each execution stores its transaction hash and links to the Monad Testnet explorer.

### Monad integration in detail

| | |
|---|---|
| Network | Monad Testnet, chain ID `10143` (CAIP-2 `eip155:10143`), RPC `https://testnet-rpc.monad.xyz` |
| Asset | Circle test USDC at [`0x534b2f3A21130d7a60830c2Df862319e593943A3`](https://testnet.monadexplorer.com/address/0x534b2f3A21130d7a60830c2Df862319e593943A3) (6 decimals). Checked on-chain: `symbol()` returns `USDC`, `decimals()` returns `6`. |
| Contracts deployed by Auctra | None. Auctra calls the standard ERC-20 `transfer(address,uint256)` on the USDC contract. |
| How a payment reaches Monad | The execution service builds the `transfer` call, Privy signs it from the user's embedded wallet through Auctra's session signer (only if the user-owned policy allows it), and Privy broadcasts it with `eth_sendTransaction` on `eip155:10143`. Auctra then reads the receipt from the Monad RPC and stores the hash. |
| What the policy pins on-chain | Chain `10143`, the USDC contract, `transfer(address,uint256)` only, no native MON value, saved recipients only, at most 100 USDC per transfer. |
| Example transaction | A real scheduled run: 1 USDC sent by an automation on Oct 8, 2026 ([`0x107f56f4…3c37ae`](https://testnet.monadexplorer.com/tx/0x107f56f4a493f579ad7ab86b3434636292fe693c1afb6bfad23330c0a13c37ae)) |
| Mainnet | Not supported. `npm run check:testnet` fails CI on any Monad mainnet reference. |

## Why it's safe

- **Your keys stay yours.** Wallets are Privy embedded wallets owned by the user. Auctra never sees a seed phrase or private key.
- **Limits enforced twice.** Per-transfer (100 USDC) and daily (250 USDC) caps are checked by Auctra, then again by a Privy policy the user owns. Auctra can't raise its own limits.
- **Saved recipients only.** Money can only go to destinations the user saved and confirmed.
- **AI never moves money.** The model only fills in fields. Validation, scheduling and execution are deterministic code.
- **Every run has an answer.** Each execution ends as sent, skipped or blocked, with the reason and the transaction hash.
- **Testnet only.** CI fails on any Monad mainnet reference.

## What's working

| | |
|---|---|
| Plain-language automations | One-time, daily, weekly and monthly schedules, timezones and DST, "only if balance is at least" conditions, memos |
| Telegram bot | Sign in, create and confirm automations, balances, history, receipts after every run |
| Web dashboard | Automations with pause, resume, cancel and Run now; destinations; activity with CSV export; settings |
| Wallets | Privy embedded wallets with a session signer and a user-owned spending policy |
| Scheduler | Runs each automation at its exact time (an Upstash QStash wake-up is booked for the due second), with a GitHub Actions backup; each run has a unique key so it can never send twice |
| Accounts | Personal and Business, with business name and destination categories |

## How it works

```mermaid
flowchart LR
  U[Telegram or web] --> C[Claude: extract fields]
  C --> V[Zod + rules]
  V --> S[Summary + Confirm]
  S --> DB[(Postgres)]
  Cron[QStash wake-up at the due time] --> E[Execution service]
  DB --> E
  E --> P[Privy signer + user-owned policy]
  P --> M[USDC transfer on Monad Testnet]
  M --> R[Receipt in Telegram]
```

Each execution moves through reserve, preflight, submit and confirm, with a unique execution key so a run can never send twice.

## Built with

| | |
|---|---|
| App | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| AI | Claude via the Anthropic SDK (intent extraction only) |
| Wallets | Privy embedded wallets, session signers and policies |
| Chain | Monad Testnet, USDC, viem |
| Data | Neon Postgres, Drizzle ORM |
| Bot | Telegram Bot API and Mini App |
| Hosting | Vercel, Upstash QStash (on-time wake-ups), GitHub Actions (backup scheduler) |
| Tests | Vitest with in-memory Postgres (PGlite), 154 tests |

## Run it locally

```sh
npm install
cp .env.example .env.local   # fill in the values below
npm run db:migrate
npm run dev
```

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `ANTHROPIC_API_KEY` | Claude, for reading requests |
| `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET` | Privy app |
| `PRIVY_AUTHORIZATION_PRIVATE_KEY`, `PRIVY_SIGNER_ID` | Auctra's session signer (`npm run spike -- keygen`) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME` (or `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`) | Telegram bot |
| `CRON_SECRET` | Protects the scheduler endpoint. Use a long random value. |
| `QSTASH_TOKEN`, `QSTASH_URL` | Upstash QStash, for on-time runs (added by Vercel's Upstash QStash integration) |
| `NEXT_PUBLIC_APP_URL` or `APP_URL` | Public URL, used for links and social previews (defaults to the Vercel production URL) |
| `AUCTRA_NETWORK`, `MONAD_CHAIN_ID`, `MONAD_RPC_URL` | `testnet`, `10143`, Monad Testnet RPC |

Privy key quorum details are in [docs/spike.md](docs/spike.md) and the comments in [.env.example](.env.example). The wallet needs testnet MON for gas and test USDC from Circle's faucet.

### Telegram

1. Create the bot with [@BotFather](https://t.me/BotFather), then send it `/setdomain` with your app's domain so Telegram login works.
2. In Vercel, add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (any long random string) and `TELEGRAM_BOT_USERNAME`, then redeploy.
3. In Privy, turn on Telegram login with the same bot token and name.
4. Open `https://<your-app>/api/telegram/setup` once. It connects the webhook and sets the bot's description, commands and Open button.

### Scheduler

Vercel only runs code when a request arrives, so something has to wake the app when an automation is due.

1. **On time (main path).** Connect Upstash QStash to the Vercel project (Storage or Marketplace → Upstash → QStash). Whenever an automation is activated or resumed, and after every run, the app books a QStash message for the exact second the next automation is due. QStash then calls `/api/cron/execute` with the `CRON_SECRET` ([lib/scheduler/wakeup.ts](lib/scheduler/wakeup.ts)).
2. **Backup.** [.github/workflows/scheduler.yml](.github/workflows/scheduler.yml) also calls `/api/cron/execute`. It's set to every 5 minutes, but GitHub runs scheduled workflows best-effort and often hours apart. Add a GitHub repository secret named `CRON_SECRET` with the same value as in Vercel. Set the `APP_URL` repository variable if your app isn't at the default URL.

Either trigger can fire any number of times: each scheduled run has a unique key, so a payment can't be sent twice. A run that's more than 24 hours late is skipped, not sent.

### Checks

```sh
npm run check:testnet   # fails on any Monad mainnet reference
npm run lint            # typed routes + typecheck
npm test                # unit and integration tests
npm run build
```

CI runs all four on every push.

## Project map

| Area | Where |
|---|---|
| Pages and dashboard | `app/`, `components/` |
| API routes | `app/api/` |
| Intent parser (Claude) | `lib/ai/intent-parser.ts` |
| Schedules (timezones, DST, month end) | `lib/schedule.ts` |
| Accounts, destinations, automations | `lib/services/` |
| Execution state machine | `lib/services/executions.ts` |
| Wallet boundary and policy | `lib/wallet/` |
| Telegram bot | `lib/telegram/` |
| Database schema and migrations | `db/schema.ts`, `drizzle/` |

## Docs

- [PRD.md](docs/PRD.md): the product spec
- [CHANGES.md](docs/CHANGES.md): every implementation decision against the spec
- [DESIGN.md](docs/DESIGN.md): colors, type and components
- [FEASIBILITY-privy-monad.md](docs/FEASIBILITY-privy-monad.md) and [spike.md](docs/spike.md): Privy on Monad Testnet, and the live check

## Hackathon disclosures

### Build window and pre-existing code

The repository was created on **October 5, 2026** and all source code, docs, brand assets and the demo video were written during the hackathon (see the commit history). There is **no pre-existing code**: the only input from before the build was the written product spec, kept in [docs/PRD.md](docs/PRD.md). Third-party libraries are used as listed below.

### AI tools

- **Claude Code** (Anthropic) was used throughout the build to write and review a large share of the code, tests and docs. Commits it made carry a `Claude-Session` link or a `Co-authored-by: Claude` line.
- **Codex** (OpenAI's GitHub review bot) reviewed some pull requests.
- **Claude** also runs inside the product: it reads a user's plain-language request and fills in the automation fields. It never moves money; validation, confirmation, scheduling and execution are deterministic code.

### Third-party code and services

| Used for | Library or service | License |
|---|---|---|
| Web framework | [Next.js](https://nextjs.org), [React](https://react.dev) | MIT |
| Styling | [Tailwind CSS](https://tailwindcss.com) | MIT |
| Fonts | Fraunces, Instrument Sans, JetBrains Mono via [Fontsource](https://fontsource.org) | SIL OFL 1.1 |
| Wallets and signing | [Privy](https://privy.io) `@privy-io/react-auth`, `@privy-io/node` | Apache-2.0 |
| Chain access | [viem](https://viem.sh) | MIT |
| AI | [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript), Claude API | MIT |
| Database | [Neon](https://neon.tech) `@neondatabase/serverless`, [Drizzle ORM / Drizzle Kit](https://orm.drizzle.team) | MIT, Apache-2.0 / MIT |
| Validation, dates | [Zod](https://zod.dev), [Luxon](https://moment.github.io/luxon) | MIT |
| Tests | [Vitest](https://vitest.dev), [PGlite](https://pglite.dev), [Playwright](https://playwright.dev) | MIT, Apache-2.0 |
| Tooling | TypeScript, tsx | Apache-2.0, MIT |
| Demo video | [Remotion](https://www.remotion.dev) | Remotion License (free for individuals and small teams) |
| Hosting and infrastructure | Vercel, Neon Postgres, Upstash QStash, GitHub Actions, Telegram Bot API | Hosted services |
| Test funds | Circle USDC on Monad Testnet, Monad faucet | — |

`@stripe/stripe-js` (MIT) is installed because Privy's React SDK imports it for its card and deposit screens. Auctra's own code doesn't use it. Full dependency versions are in [package.json](package.json) and [package-lock.json](package-lock.json).

## License

[MIT](LICENSE). Third-party libraries keep their own licenses, listed above.

## Status

Hackathon build. Testnet only, test USDC only, not financial advice.
