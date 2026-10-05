# Auctra — Frozen MVP PRD

## Product
**Auctra** is an autonomous financial agent that lets individuals automate recurring and conditional onchain money movement using natural language.

**Tagline:** Tell Auctra what you want your money to do. It handles the rest.

## MVP boundary
- Network: Monad Testnet only
- Chain ID: 10143
- Asset: USDC only
- Primary interface: Telegram
- Secondary interface: minimal web dashboard
- Wallet: Privy Embedded Wallet + scoped delegated execution
- AI: Claude API
- Database: Neon PostgreSQL + Drizzle
- Scheduler: Vercel Cron
- Blockchain client: viem

## Supported automations
1. Scheduled savings
2. Recurring USDC payments
3. Conditional USDC transfers with minimum-balance checks
4. Balance protection

## Explicitly out of scope
Mainnet, fiat banking, cards, real-world merchant subscriptions, trading, perps, lending, yield optimization, NFTs, cross-chain execution, multiple stablecoins, custom Auctra contracts, agent-to-agent payments, investment advice, portfolio management, broad risk scoring, and a large dashboard.

## Security invariant
Auctra never collects, stores, transmits, logs, or exposes private keys or seed phrases. The LLM never signs or broadcasts transactions.

## Execution architecture
User message → Claude structured intent → Zod validation → deterministic policy validation → explicit user confirmation → persisted automation → scheduler → final preflight checks → Privy delegated execution → Monad Testnet → execution record → Telegram result.

## Required API surface
- POST /api/ai/intent
- POST /api/automations
- GET /api/automations
- PATCH /api/automations/:id
- POST /api/automations/:id/run
- GET /api/executions
- GET /api/balance
- POST /api/cron/execute
- POST /api/telegram/webhook

## Acceptance criteria
- No seed/private-key onboarding
- Testnet wallet and USDC balance visible
- Natural-language scheduled transfer works
- Exact confirmation before activation
- Automation persists across restarts
- Due automation executes exactly once
- Transaction hash captured
- Success/failed/skipped result shown
- Insufficient balance safely skips
- Paused/cancelled automations never execute
- Unsupported chain/token rejected
- LLM cannot invoke wallet execution
- No private key/seed phrase in source, database, logs, API payloads, or prompts
- Mainnet chain IDs rejected

## Build rule
This document is the source of truth. Do not add a new chain, asset, provider, contract, or execution capability without explicitly revising the PRD.
