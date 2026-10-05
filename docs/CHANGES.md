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
