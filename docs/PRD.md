# Auctra — Final Product Requirements Document

**Autonomous Financial Agent · Monad Metropolis Hackathon MVP**
**Version 2.2 · FROZEN · Implementation-ready**

This file is the single authoritative PRD (§23). It supersedes `Auctra_Final_PRD_v2.docx`.

## Changelog

**v2.2** adds **businesses** to the ICP, alongside individuals. The rest of the frozen product contract is unchanged: chain, asset, wallet provider, security boundary and core automation model.

| # | Change | Sections |
|---|---|---|
| 1 | Target users are individuals **and** businesses. | 4, 27 |
| 2 | Every user owns an **account** of type `INDIVIDUAL` or `BUSINESS`. Wallets, destinations and automations belong to the account. | 6, 9, 18 |
| 3 | Business use cases: vendor payments, contractor payouts, treasury reserve sweeps, operating-wallet floor. | 5 |
| 4 | Destinations get a **category** (savings, vendor, contractor, …). Automations get an optional **memo** (e.g. an invoice reference). | 9, 18 |
| 5 | Execution history can be exported as **CSV** for bookkeeping. | 12, 19 |
| 6 | Multi-member business accounts, roles, approvals, KYB, invoicing and accounting integrations stay **out of scope**. The account boundary makes them additive later. | 24, 25 |

Implementation decisions taken while building are logged in `docs/CHANGES.md`.

**v2.1** clarifies v2.0. The frozen product contract (§27) is unchanged: category, wallet provider, chain, asset, core automation model and security boundary. The changes are:

| # | Change | Sections |
|---|---|---|
| 1 | Privy delegation is defined as **session signers**: Auctra holds one app-level P-256 **authorization key**. That key is explicitly permitted; user keys are still forbidden. | 7.1, 7.2, 17 |
| 2 | The **Privy Policy Engine** is required as a second, provider-side scope boundary. | 7.2, 7.3 |
| 3 | Onboarding includes a **web step** (Telegram Mini App or dashboard link), because Privy login and signer consent cannot happen inside a chat. | 6 |
| 4 | **Saved destinations** are new: named, user-confirmed addresses. The LLM never produces raw addresses for execution. | 7.3, 8, 9, 18 |
| 5 | **Timezones** are new: per-user IANA timezone, plus rules for daylight-saving time and month length. | 9 |
| 6 | **Conditions** are precise: `MIN_BALANCE` is checked before a transfer; balance protection is a wallet floor checked after it. | 5, 9 |
| 7 | An **execution state machine**, retry rules, missed-occurrence rules and Run Now keys are specified. | 10 |
| 8 | **Vercel Cron** details: GET requests, `CRON_SECRET`, plan cadence. | 10, 17, 19 |
| 9 | **USDC contract** pinned and verified on-chain at startup; decimals = 6. | 17 |
| 10 | Telegram update de-duplication and confirmation binding are required. | 11 |
| 11 | **Edit is removed** from the MVP (cancel + re-create instead). | 6, 11, 12, 19 |
| 12 | Build order puts the Privy → Monad USDC spike first; the document's numbering is fixed. | 23 |
| 13 | Open questions are listed explicitly. | 29 |

---

## Decision summary

| Decision | Final |
|---|---|
| Product | Auctra — autonomous financial agent |
| Primary interface | Telegram bot |
| Secondary interface | Minimal web dashboard (also hosts the Privy onboarding step) |
| Blockchain | Monad Testnet only (chain ID 10143) |
| Asset | USDC only |
| Wallet infrastructure | Privy embedded wallets |
| Execution | Privy session signer (Auctra authorization key) + Privy policy |
| AI | Natural language → structured financial intent |
| Database | Neon PostgreSQL + Drizzle |
| Deployment | Vercel |
| Coding agent | Claude Code |
| Mainnet | Explicitly out of scope |

## 1. Executive summary

Auctra is an autonomous financial agent. It lets individuals automate recurring and conditional onchain money movement using natural language. A user describes once what they want their money to do. Auctra then:

1. converts the instruction into a deterministic automation,
2. validates it against wallet and policy constraints,
3. executes it on Monad Testnet through delegated wallet infrastructure,
4. reports the result in Telegram.

The MVP deliberately avoids becoming a generic AI financial adviser, a trading bot, a banking replacement or a custom smart-contract protocol. It proves one narrow thesis: autonomous money operations can be expressed simply while execution stays deterministic, permissioned, auditable and testnet-only.

## 2. Product thesis

**Core promise:** "Tell Auctra what you want your money to do. It handles the rest."

**Category:** Autonomous Financial Agent / AI Financial Operations Agent.

Auctra is the automation layer between a user's financial intent and delegated wallet execution. Users never surrender private keys.

## 3. Non-negotiable constraints

- Monad Testnet only. No mainnet execution path.
- USDC only.
- No custom smart contracts in the MVP.
- Auctra never collects, stores, logs, transmits or exposes a user's private key or seed phrase.
- The LLM never directly signs or broadcasts blockchain transactions.
- Natural-language instructions become typed intents, which deterministic application code then validates.
- Every execution is idempotent and traceable to an automation occurrence.
- Auctra fails closed if any check fails: permission, network, asset, destination, balance, schedule or policy.
- The MVP is testnet software, not a real-funds financial service.

## 4. Target users (v2.2)

Auctra serves two segments from day one, with the same product and the same security boundary.

**Individuals:** crypto-native people who hold stablecoins and want recurring or rule-based money movement, without manually starting the same transaction every week or month.

**Businesses:** small, stablecoin-native businesses whose founder or operator runs payments: startups, agencies, online businesses and crypto-native teams. They want recurring vendor and contractor payments, and they want to keep an operating wallet funded and its surplus swept to a reserve, without someone remembering to send each transfer.

In the MVP, a business account has **one operator** (the account owner), who acts through Telegram and the dashboard like an individual does. What differs is the account type and business name, the destination categories, payment memos and the CSV export.

**Future:** multi-member business accounts with roles and approvals, DAOs and treasury teams (§25).

## 5. MVP use cases

| Use case | Example | MVP | v2.1 meaning |
|---|---|---|---|
| Scheduled savings | Save 20 USDC every Friday. | Yes | Scheduled transfer to a saved destination |
| Recurring payment | Pay this wallet 100 USDC on the 1st, monthly. | Yes | Scheduled transfer to a saved destination |
| Conditional transfer | Send 50 USDC every Monday only if balance ≥ 300. | Yes | `MIN_BALANCE` condition, checked **before** the transfer |
| Balance protection | Never let my spending wallet fall below 300 USDC. | Yes | Wallet `balance_floor`, checked **after** the transfer, for every automation on that wallet |
| Vendor payment (business) | Pay Acme Hosting 80 USDC on the 1st of every month, memo "INV hosting". | Yes | Scheduled transfer to a saved `VENDOR` destination, with memo |
| Contractor payout (business) | Pay Ada 100 USDC every Friday. | Yes | One scheduled transfer per contractor (no batch payouts in the MVP) |
| Reserve sweep (business) | Move 50 USDC to the reserve wallet every Monday if the balance is ≥ 500. | Yes | Scheduled transfer to a `TREASURY` destination + `MIN_BALANCE` |
| Operating floor (business) | Never let the operating wallet fall below 1,000 USDC. | Yes | Wallet `balance_floor` |
| Batch payroll / mass payouts | Pay these 12 people on the 25th. | No | Future |
| Approvals | A second person approves payments over X. | No | Future |
| Trading | Buy MON when the price drops 5%. | No | |
| DeFi yield | Move idle funds to the best yield. | No | |
| Fiat/card subscriptions | Netflix, utilities, bank debit. | No | |
| Multi-chain | Ethereum, Base, Solana, etc. | No | |

Balance protection never moves money *into* a wallet (no top-ups). It only blocks outgoing transfers that would break the floor.

## 6. Core user journey

1. Start the Auctra Telegram bot (`/start`).
2. **Web step (v2.1):** the bot sends a link that opens the dashboard as a Telegram Mini App, or in a browser. There the user:
   - logs in with Privy (Telegram login),
   - chooses an account type: **Individual**, or **Business** with a business name (v2.2),
   - gets an embedded wallet provisioned,
   - saves at least one destination (v2.2: the Privy policy allowlist can't be empty, so this comes before the signer),
   - reviews the delegation disclosure (§7.2),
   - adds Auctra's session signer, with the Auctra policy attached.

   The Telegram user is linked to the Privy user.
3. Fund the wallet on Monad Testnet with MON for gas and with testnet USDC.
4. **Save a destination (v2.1):** add a named destination, e.g. "savings wallet → 0x…". Auctra shows the full address and the user confirms it.
5. Describe an automation in natural language.
6. Parse the request into a structured `FinancialIntent`.
7. Validate the asset, chain, amount, destination, schedule, timezone, conditions and permission scope.
8. Present a human-readable summary and ask for explicit confirmation.
9. Persist the confirmed automation as `ACTIVE`.
10. The scheduler evaluates due automations.
11. The execution engine performs final checks and invokes the Privy session signer.
12. Monad Testnet executes the transfer.
13. Store the result and send a Telegram confirmation.
14. The user can pause, resume, run now or cancel. Editing is done by cancelling and re-creating (v2.1).

## 7. Security and key management

### 7.1 Private-key rule

Auctra never requests a seed phrase or raw private key from a user. No database field, API parameter, log entry, analytics event, prompt variable, Telegram message or environment variable may be designed to hold a **user's** private key.

**Permitted exception (v2.1):** exactly one app-level secret, `PRIVY_AUTHORIZATION_PRIVATE_KEY`, may exist. It is a P-256 key that authorizes Auctra's requests to Privy as a session signer. It cannot sign transactions by itself, and Privy enforces the attached policy on every request it authorizes.

This key:
- lives only in server-side environment configuration,
- is never logged, returned in API payloads, sent to the client or included in prompts,
- can be rotated by registering a new key in Privy and removing the old one.

### 7.2 Privy model

Use **Privy embedded wallets with session signers**. ("Delegated actions" is the older name for this feature.)

- The user owns the wallet.
- During onboarding (§6 step 2), the user adds Auctra's authorization key as a session signer, through a Privy key quorum.
- A **Privy policy** is attached to that signer (§7.3). Privy refuses any request outside it, even if Auctra's own validation has a bug.
- The user can revoke the signer at any time from Settings/Security. Every automation then fails closed with `MISSING_PERMISSION`.
- The product must clearly disclose the delegated authority, its scope (Monad Testnet, USDC, saved destinations, per-transfer cap) and how it can be revoked.

### 7.3 Fail-closed rules

Every execution is checked by two independent layers:

**Layer 1 — Auctra deterministic validator** (`lib/wallet/executor.ts` and the automation service):

| Condition | Outcome |
|---|---|
| Wrong chain | reject (`WRONG_CHAIN`) |
| Unsupported token | reject (`UNSUPPORTED_ASSET`) |
| Destination is not this automation's saved, confirmed destination | reject (`INVALID_DESTINATION`) |
| Destination is the source wallet or the token contract | reject (`INVALID_DESTINATION`) |
| Amount ≤ 0, more than 6 decimals, or above the per-transfer cap | reject (`INVALID_AMOUNT`) |
| Transfer would exceed the per-user rolling 24h cap | skip and notify (`DAILY_CAP`) |
| Insufficient balance | skip and notify (`INSUFFICIENT_BALANCE`); never execute partially |
| `MIN_BALANCE` condition not met before the transfer | skip and notify (`CONDITION_NOT_MET`) |
| Balance after the transfer would fall below the wallet's `balance_floor` | skip and notify (`BALANCE_FLOOR`) |
| Automation expired, paused or cancelled | reject |
| Duplicate execution key | reject (database unique constraint) |
| Signer missing or revoked | reject and notify (`MISSING_PERMISSION`) |
| Ambiguous AI output | ask the user to clarify; never guess |

**Layer 2 — Privy policy**, attached to Auctra's session signer. It allows only `eth_sendTransaction` where:
- `chain_id = 10143`,
- `to` = the USDC contract,
- the calldata is `transfer(recipient, amount)`,
- `recipient` is in the user's saved destinations,
- `amount` ≤ the per-transfer cap.

The policy is updated when the user adds or removes a destination. Everything else is denied.

MVP defaults: per-transfer cap **100 USDC**, daily cap **250 USDC**. These are configuration constants, not user-editable in the MVP.

## 8. AI architecture

The AI is an intent interface, not the transaction executor.

```
User message
  ↓ Claude API
FinancialIntent (strict schema)
  ↓ Schema validation (Zod)
  ↓ Destination label → saved destination (deterministic lookup)
  ↓ Deterministic policy/constraint validation
  ↓ Human confirmation
Persist automation
  ↓ Scheduler
  ↓ Execution engine
  ↓ Privy session signer (+ Privy policy)
Monad Testnet
```

Example intent:

```json
{
  "action": "TRANSFER",
  "asset": "USDC",
  "amount": "20",
  "destination": { "label": "savings wallet" },
  "schedule": { "frequency": "WEEKLY", "dayOfWeek": "FRIDAY", "time": "18:00" },
  "conditions": []
}
```

**Destinations (v2.1):** the intent names a destination either by the label of a saved destination or by a literal address that the user typed. A literal address is never executed directly. It starts the "save destination" flow (§6 step 4) before the automation can be confirmed. The LLM never invents, completes or "corrects" an address.

**Timezone:** times in the intent are wall-clock times in the user's stored timezone. The LLM does not convert timezones.

The LLM may extract and normalize intent. It must never enforce authorization, limits, balances or security rules, and must never directly invoke wallet execution.

## 9. Automation model

| Field | Purpose |
|---|---|
| automation_id | Stable identifier |
| account_id | Owning account, individual or business (v2.2) |
| wallet_id | Execution wallet reference |
| destination_id | Saved, confirmed destination (v2.1) |
| action | `TRANSFER` |
| asset | `USDC` |
| amount | Exact decimal amount, max 6 decimals |
| schedule | `ONCE` / `DAILY` / `WEEKLY` / `MONTHLY` + time (+ day) |
| timezone | IANA timezone, copied from the user at creation (v2.1) |
| conditions | Supported conditions (below) |
| status | `ACTIVE` / `PAUSED` / `CANCELLED` / `COMPLETED` (for `ONCE`) |
| next_run_at | Next occurrence (UTC instant) |
| last_run_at | Last attempt |
| execution_count | Successful execution count |
| memo | Optional free-text reference, ≤ 140 characters, e.g. an invoice number (v2.2). Never sent on-chain. |

**Conditions (MVP):**
- `MIN_BALANCE { amount }`: the wallet's USDC balance must be ≥ `amount` **before** the transfer.
- Wallet `balance_floor` (a wallet setting, not a per-automation condition): the USDC balance **after** the transfer must stay ≥ the floor. It applies to every automation on that wallet.

**Schedule rules (v2.1):**
- Users have an IANA timezone, asked for at onboarding, defaulting to the browser timezone from the web step. Occurrences are computed in that timezone and stored as UTC.
- During a daylight-saving gap, a wall-clock time that doesn't exist runs at the first valid minute after it. A time that is repeated runs only once, at its first occurrence.
- `dayOfMonth` 29–31 runs on the last day of shorter months.
- `ONCE` automations become `COMPLETED` after one terminal execution.

## 10. Scheduler, execution and idempotency

**Scheduler.** Vercel Cron calls `GET /api/cron/execute` with `Authorization: Bearer $CRON_SECRET`. The endpoint rejects any other caller. Cadence:
- Every minute on Vercel Pro.
- On Hobby, cron runs at most daily with imprecise timing. The demo relies on Run Now, and that limitation is accepted.

PostgreSQL remains the source of truth.

**Execution keys:**
- Scheduled: `execution_key = ${automationId}:${scheduledOccurrenceIso}`
- Run Now: `execution_key = ${automationId}:manual:${requestId}`. It does not consume or shift the scheduled occurrence.

A unique database constraint on `execution_key` prevents duplicate execution. The same key is sent to Privy as the request idempotency key.

**Execution state machine (v2.1):**

```
PENDING ──► SUBMITTED ──► CONFIRMED
   │            └──────► FAILED (reverted on-chain)
   ├──► SKIPPED (preflight: balance, condition, floor, daily cap, missed window)
   ├──► REJECTED (validation / permission)
   └──► UNKNOWN (outcome not known; manual reconciliation)
```

1. **Reserve.** Insert the execution row as `PENDING`. If the unique key conflicts, stop.
2. **Preflight.** Run every Layer 1 check. On failure, mark `SKIPPED` or `REJECTED` with an `error_code` and notify. Nothing is sent.
3. **Submit.** Call the Privy signer with the execution key as the idempotency key, then store `tx_hash` and mark `SUBMITTED`.
4. **Confirm.** Wait for the receipt, in this request or in the next cron pass. Mark `CONFIRMED` or `FAILED`, then notify.
5. **Advance.** Set `next_run_at` to the next occurrence after *now*, not after the missed one.

**Retry rules:**
- A `PENDING` row with no `tx_hash` that is older than 5 minutes becomes `UNKNOWN` (v2.2). It is not resubmitted automatically, even with the same idempotency key, until Privy's idempotency window is verified (§29). Preflight errors (e.g. the balance can't be read) happen before anything is sent, so they are recorded as `SKIPPED` with `PREFLIGHT_ERROR`, never `UNKNOWN`.
- A `SUBMITTED` row with no receipt after 1 hour becomes `UNKNOWN`.
- `UNKNOWN` is never resent automatically. Telegram tells the user and the operator, and someone reconciles it by checking the wallet's on-chain history.
- `SUBMITTED` rows are never resent. They are confirmed by `tx_hash` only.

**Missed occurrences:** if cron was down, only the most recent due occurrence runs, and only if it is less than 24 hours old; otherwise that occurrence is recorded as `SKIPPED` with `MISSED_WINDOW`. Earlier missed occurrences are counted in one `OCCURRENCES_MISSED` audit event, not one row each (v2.2). Missed payments are never batch-executed.

A durable queue/worker can replace this in production; it is not required for the hackathon.

## 11. Telegram bot

Commands:

| Command | Purpose |
|---|---|
| `/start` | Onboarding; sends the web-step link |
| `/balance` | Testnet MON + USDC balances |
| `/automations` | Active automations |
| `/new` | Create an automation |
| `/destinations` | List or add saved destinations (v2.1) |
| `/run` | Run Now for an active automation (v2.2) |
| `/pause` | Pause |
| `/resume` | Resume |
| `/cancel` | Cancel |
| `/history` | Recent executions |
| `/help` | Supported actions |

Rules:
- Natural language works without commands. "Never let my wallet fall below X" sets the balance floor after a confirmation button (v2.2).
- Buttons are reserved for confirmation and high-value actions. Do not build a button-heavy interface.
- The webhook verifies `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET`.
- **Updates are de-duplicated on `update_id` (v2.1)**, because Telegram retries undelivered updates.
- **Confirmation buttons (v2.1)** carry only a confirmation ID. On press, Auctra checks that the confirmation belongs to the pressing Telegram user, hasn't expired (10 minutes) and hasn't been used, and that its `intent_hash` matches the stored payload.
- The webhook acknowledges Telegram quickly and stays within Vercel's function timeout, including the Claude call.

## 12. Web dashboard

- Landing page
- Onboarding: Privy login, wallet, session signer consent (Telegram Mini App compatible)
- Balance + active automations
- Automation detail / create (no edit in the MVP)
- Saved destinations, with categories
- Execution history, with CSV export (v2.2)
- Settings/security: timezone, balance floor, revoke Auctra's signer

Telegram is the primary product surface. The dashboard exists to host onboarding and to make state and execution legible during the demo.

## 13. UX rules

- Users should not need to understand blockchain terminology to create an automation.
- Before confirmation, always show the amount, asset, destination (label **and** full address), schedule with timezone, and conditions.
- Always disclose that execution happens on Monad Testnet.
- Every action ends in one of three outcomes the user sees: success (`CONFIRMED`), skipped (`SKIPPED`), or failed (`FAILED` / `REJECTED` / `UNKNOWN`).
- Do not build a generic AI chat UI.
- No trading charts, token lists, DeFi screens or unnecessary navigation.

## 14. Brand and visual system

| Element | Final |
|---|---|
| Brand | Auctra |
| Category | Autonomous Financial Agent |
| Tagline | Tell Auctra what you want your money to do. It handles the rest. |
| Typography | Inter; JetBrains Mono for hashes/data |
| Obsidian | `#0B0D0F` |
| Signal Green | `#35D07F` |
| Amber | `#F2B84B` |
| Red | `#EF5B5B` |
| Cloud | `#F5F6F4` |
| Slate | `#667078` |
| Border | `#DCE1DE` |
| Geometry | 8px buttons · 12px cards · 16px large surfaces |

Visual direction: institutional, technical, precise and trustworthy. Avoid neon crypto aesthetics, trading-terminal clutter, cartoon AI imagery and generic SaaS gradients.

## 15. Technical architecture

```
Telegram ──┐
Web (Mini App / dashboard, Privy React SDK) ──┐
           ↓
Next.js API / application layer
  ├─ Auth + user linking (Privy ↔ Telegram)
  ├─ Claude intent parser
  ├─ Intent schema validation
  ├─ Destination service
  ├─ Automation service
  ├─ Deterministic policy validator
  ├─ Scheduler endpoint (Vercel Cron, GET + CRON_SECRET)
  └─ Execution service  ← the only caller of the wallet signer
           ↓
Privy wallet API (@privy-io/node) — session signer + policy
           ↓
Monad Testnet (chain 10143) — USDC transfer()

Neon PostgreSQL:
  users / wallets / destinations / automations / executions /
  confirmations / telegram_updates / audit_events
```

## 16. Technology stack

| Layer | Technology |
|---|---|
| Coding agent | Claude Code |
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Database | Neon PostgreSQL |
| ORM | Drizzle |
| Wallet (client) | Privy React SDK (`@privy-io/react-auth`) |
| Wallet (server) | Privy Node SDK (`@privy-io/node`) |
| Blockchain client | viem |
| AI | Anthropic Claude API |
| Bot | Telegram Bot API |
| Scheduler | Vercel Cron |
| Hosting | Vercel |
| Testing | Vitest + Playwright |
| Repository | GitHub, with CI (testnet guard, typecheck, tests) |

## 17. Environment variables

```
NEXT_PUBLIC_APP_URL=
DATABASE_URL=
ANTHROPIC_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_AUTHORIZATION_PRIVATE_KEY=   # v2.1 — app-level session signer key (§7.1)
PRIVY_SIGNER_ID=                   # v2.2 — key quorum ID of that key; session signer + policy owner
CRON_SECRET=                       # v2.1 — Vercel Cron bearer token

# TESTNET ONLY
AUCTRA_NETWORK=testnet
MONAD_CHAIN_ID=10143
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
AUCTRA_SUPPORTED_ASSET=USDC
```

**USDC contract (v2.1):** the address is a code constant, not an environment variable, so configuration can't silently point at another token:
- Circle testnet USDC on Monad Testnet: `0x534b2f3A21130d7a60830c2Df862319e593943A3`
- 6 decimals.

Before any execution, the app checks on-chain that `symbol() == "USDC"` and `decimals() == 6`, and fails closed if not. (The address needs re-confirming against Circle's docs before the demo; see §29.)

Never create environment variables for user private keys, seed phrases or exported wallet credentials. The only signer secret allowed is the authorization key in §7.1.

## 18. Database model

| Table | Key fields |
|---|---|
| users | id, telegram_id (unique), privy_user_id (unique), timezone, created_at |
| accounts (v2.2) | id, owner_user_id (unique in MVP), type (`INDIVIDUAL` / `BUSINESS`), business_name, created_at |
| wallets | id, account_id, privy_wallet_id (unique), address, chain_id, status, signer_status, privy_policy_id, balance_floor |
| destinations (v2.1) | id, account_id, label, address, category (v2.2), confirmed_at, created_at; unique (account_id, label) and unique (account_id, address) |
| automations | id, account_id, wallet_id, destination_id, action, asset, amount, schedule (jsonb), timezone, conditions (jsonb), memo (v2.2), status, next_run_at, last_run_at, execution_count |
| executions | id, automation_id, execution_key (unique), trigger (`SCHEDULED` / `MANUAL`), scheduled_for, status, tx_hash, error_code, created_at, submitted_at, finalized_at |
| confirmations | id, user_id, intent_hash, payload (jsonb), confirmed_at, used_at, expires_at |
| telegram_updates (v2.1) | update_id (primary key), received_at |
| audit_events | id, user_id, event_type, metadata (jsonb), created_at |

Statuses are Postgres enums. Amounts are stored as exact decimal strings, or as integer base units, and never as floats. No table may store private keys or seed phrases.

## 19. API surface

| Endpoint | Purpose |
|---|---|
| `POST /api/ai/intent` | Parse natural language into a `FinancialIntent` |
| `GET /api/destinations` | List saved destinations |
| `POST /api/destinations` | Save a destination (requires confirmation) |
| `POST /api/automations` | Create a confirmed automation |
| `GET /api/automations` | List the user's automations |
| `PATCH /api/automations/:id` | Pause / resume / cancel (no edit in the MVP) |
| `GET /api/me`, `PATCH /api/settings` | Account summary; timezone and balance floor (v2.2) |
| `POST /api/onboarding/{link,account,wallet}`, `GET/POST /api/onboarding/signer` | Web onboarding steps (v2.2) |
| `POST /api/destinations/confirm`, `DELETE /api/destinations/:id` | Confirm a proposed destination; archive one (v2.2) |
| `POST /api/automations/:id/run` | Manual demo execution (Run Now) |
| `GET /api/executions` | Execution history (`?format=csv` for export, v2.2) |
| `GET /api/balance` | Read testnet balance |
| `GET /api/cron/execute` | Scheduler endpoint (Vercel Cron, bearer `CRON_SECRET`) |
| `POST /api/telegram/webhook` | Telegram updates (secret-token header) |

## 20. Mainnet guardrails

- The UI must not expose a network switch.
- The backend rejects chain IDs other than 10143.
- The testnet RPC is the only execution RPC configured for the hackathon.
- The Privy policy also pins `chain_id = 10143`.
- CI (`npm run check:testnet`) fails if the Monad mainnet chain ID, its CAIP-2 ID, the viem `monad` mainnet chain, or the mainnet USDC address appears in tracked source.

```ts
const MONAD_TESTNET_CHAIN_ID = 10143 as const;
if (chainId !== MONAD_TESTNET_CHAIN_ID) {
  throw new Error("Auctra MVP supports Monad Testnet only.");
}
```

## 21. Acceptance criteria

- [ ] User can onboard without providing a seed phrase or private key.
- [ ] User can provision the Privy wallet and grant Auctra's session signer from a Telegram-launched web step.
- [ ] User can revoke the signer, after which every automation fails closed.
- [ ] User can view Monad Testnet balance.
- [ ] User can save a named destination and must confirm its full address.
- [ ] User can create a scheduled USDC transfer to a saved destination using natural language.
- [ ] Auctra shows an exact confirmation summary, including timezone, before activation.
- [ ] Automation persists across restarts.
- [ ] Scheduler executes a due automation exactly once, including when cron runs concurrently or retries.
- [ ] Run Now executes without affecting the scheduled occurrence.
- [ ] Transaction hash is captured and displayed.
- [ ] Telegram reports success, failure or skipped state.
- [ ] Insufficient balance, an unmet condition, the balance floor and the daily cap each safely skip execution.
- [ ] Paused or cancelled automations never execute.
- [ ] Unsupported chain or token is rejected.
- [ ] A transfer to a non-allowlisted address is refused by the Privy policy, even when Auctra's validation is bypassed (spike test).
- [ ] The LLM cannot directly invoke wallet execution.
- [ ] No user private key or seed phrase appears in source, database, logs, API payloads or prompts. The authorization key appears only in server environment configuration.
- [ ] Mainnet chain IDs are rejected, and CI enforces it.
- [ ] The entire demo runs on Monad Testnet assets.
- [ ] A user can onboard as a Business with a business name; the dashboard and Telegram show it (v2.2).
- [ ] Destinations carry a category; automations can carry a memo shown in history (v2.2).
- [ ] Execution history exports to CSV (v2.2).

## 22. Hackathon demo

Before the demo: onboard, fund the wallet, and save a "savings wallet" destination.

1. Open the Auctra Telegram bot.
2. Show the testnet wallet and USDC balance.
3. Create: "Save 20 USDC to my savings wallet every Friday at 6 PM."
4. Show the parsed automation summary (destination label + address, Friday 18:00 in the user's timezone).
5. Confirm it.
6. Show the `ACTIVE` automation on the dashboard.
7. Use Run Now to demonstrate execution without waiting for Friday.
8. Show the Monad Testnet transaction in the explorer.
9. Return to Telegram and show the confirmation and transaction hash.
10. Show the execution history and audit trail.
11. Explain the security boundary: no private keys, a session signer bounded by the Privy policy, testnet only.

## 23. Claude Code build rules

- Read this PRD before changing architecture.
- One repository and one authoritative PRD (this file). Don't have multiple agents edit the same working tree at the same time.
- Build deterministic execution before polishing AI.
- Use strict Zod/TypeScript schemas for AI output.
- Keep wallet execution behind one service boundary (`lib/wallet/executor.ts`).
- Test every financial execution path.
- Never add private-key import.
- Never add a mainnet toggle.
- Don't add chains, tokens, wallet providers or custom contracts without a PRD revision.
- Prefer the smallest implementation that satisfies an acceptance criterion.

**Build order (v2.1):**

1. Foundation
2. **Spike: Privy server-signed USDC transfer on Monad Testnet + Privy policy** (`npm run spike`; see `docs/spike.md`). Go/no-go gate.
3. Neon + Drizzle (v2.1 schema)
4. Deterministic execution service + state machine
5. Privy onboarding / wallet / session signer (web step, Telegram Mini App)
6. Destinations + automation CRUD
7. Scheduler + idempotency
8. Telegram bot
9. Claude intent parser
10. Confirmation flow
11. Dashboard
12. Security tests
13. E2E demo
14. UI polish
15. Final QA

## 24. Explicitly out of scope

Mainnet · fiat banking · card payments · merchant subscription APIs · trading · perpetuals · lending · yield optimization · NFTs · cross-chain execution · multiple stablecoins · custom Auctra smart contracts · agent-to-agent payments · complex organizational approvals · financial advice · autonomous portfolio management · automation editing (v2.1) · balance top-ups (v2.1) · multi-member business accounts, roles and approvals (v2.2) · batch/mass payouts (v2.2) · KYB/KYC (v2.2) · invoicing and accounting integrations (v2.2).

## 25. Future roadmap

- Business accounts with multiple members, roles and approval workflows (builds on the v2.2 account model)
- Batch payouts and payroll schedules
- Accounting exports and integrations beyond CSV
- Multiple assets and chains
- Merchant/subscription integrations
- Richer conditions
- Treasury operations
- Agent-to-agent payments
- Auctra authorization API
- Auctra policy/authorization infrastructure

The application can later become the first consumer of the original authorization thesis; we are proving the user workflow before building infrastructure.

## 26. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Users misunderstand delegated signing | Clear consent and scope disclosure; one-tap revoke |
| Unsafe LLM output | Strict schema + deterministic validation + confirmation; no raw LLM addresses |
| Bug in Auctra's validator | Privy policy as an independent second boundary |
| Duplicate payment | Unique execution key + DB constraint + Privy idempotency key + state machine |
| Missed schedule | Persisted `next_run_at`; latest occurrence within 24h only |
| Outcome unknown after timeout | `UNKNOWN` state, never auto-resent, manual reconciliation |
| Insufficient funds | Preflight check + skipped state |
| Mainnet accidentally enabled | Hard testnet guard + Privy policy chain pin + CI check + no network switch |
| Privy onboarding doesn't fit inside Telegram | Telegram Mini App / web step; validated by the spike and step 5 |
| Testnet USDC/MON hard to obtain for demo | Fund demo wallets ahead of time; document faucets |
| Authorization key leak | Server-only env; policy limits the damage; rotate via Privy |
| Provider API changes | Wallet service abstraction (`WalletSigner`) |
| Vercel Hobby cron cadence | Pro plan or Run Now for the demo |
| Scope explosion | Frozen MVP and acceptance criteria |

## 27. Product freeze

This document is the implementation source of truth for the Monad Metropolis hackathon build. Product category, wallet provider, blockchain, asset, core automation model and security boundary are frozen. Implementation details may improve without changing the product contract.

**FROZEN MVP:** Telegram-first autonomous financial agent for individuals and businesses → Privy session-signer wallet execution → USDC → Monad Testnet → deterministic automation + audit trail.

## 28. Technical references

- Privy user wallets: https://www.privy.io/user-wallets
- Privy user terms / delegated actions: https://www.privy.io/user-terms-of-service
- Privy wallet actions: https://www.privy.io/insights/introducing-wallet-actions
- Privy Policy Engine: https://privy.io/blog/turning-wallets-programmable-with-privy-policy-engine
- Privy Node SDK: https://www.npmjs.com/package/@privy-io/node
- Circle USDC contract addresses: https://developers.circle.com/stablecoins/usdc-contract-addresses
- Monad Testnet RPC: https://testnet-rpc.monad.xyz

## 29. Open questions (v2.1)

These must be answered by the spike (build step 2) before step 3 starts:

1. Does Privy's `eth_sendTransaction` support CAIP-2 `eip155:10143` (Monad Testnet) out of the box, or does the chain or RPC have to be configured in the Privy dashboard?
2. Do the calldata conditions in the Privy policy (`transfer.recipient`, `transfer.amount`) behave as built in `buildUsdcTransferPolicy()`? Test that a non-allowlisted recipient and an over-cap amount are refused.
3. What is Privy's idempotency-key window? It sets the `PENDING` retry limit in §10.
4. Does Privy Telegram login work inside a Telegram Mini App for wallet creation and adding a session signer?
5. Is Privy gas sponsorship available on Monad Testnet? If not, users need MON for gas, which is the current assumption.
6. Re-confirm the Monad Testnet USDC address against Circle's docs, and find a reliable testnet USDC faucet.
