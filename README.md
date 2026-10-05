# Auctra

Autonomous financial agent for recurring and conditional USDC payments, for **individuals and businesses**.
Tell Auctra what you want your money to do (in Telegram or the dashboard). It confirms the exact details, then runs the
transfer on schedule from your own Privy wallet, within limits enforced both by Auctra and by Privy.

- **Network:** Monad Testnet only (chain ID 10143). There is no mainnet path.
- **Asset:** USDC only.
- **Spec:** `docs/PRD.md` (v2.2). Every implementation decision is logged in `docs/CHANGES.md`.

## How it works

```
Telegram / dashboard ─► Claude (extract fields only) ─► Zod + deterministic validation
   ─► exact summary + Confirm ─► automation (Postgres) ─► Vercel Cron
   ─► execution service (reserve → preflight → submit → confirm, unique execution key)
   ─► Privy session signer + Privy policy ─► Monad Testnet USDC transfer() ─► Telegram receipt
```

| Area | Where |
|---|---|
| Schema + migrations | `db/schema.ts`, `drizzle/` |
| Schedules (timezones, DST, month end) | `lib/schedule.ts` |
| Accounts, destinations, confirmations, automations | `lib/services/*.ts` |
| Execution state machine + scheduler | `lib/services/executions.ts` |
| Single wallet boundary | `lib/wallet/executor.ts`, `lib/wallet/privy.ts` |
| Intent parser (Claude) | `lib/ai/intent-parser.ts` |
| Telegram bot | `lib/telegram/bot.ts`, `app/api/telegram/webhook` |
| API (PRD §19) | `app/api/**` |
| Onboarding web step + dashboard | `app/onboarding`, `app/dashboard` |

## Development

```sh
npm install
npm run check:testnet   # fails on any Monad mainnet reference
npm run lint            # typed routes + typecheck
npm test                # unit + integration tests (in-memory Postgres via PGlite)
npm run build
```

## Setup

1. **Privy:** create an app and enable Telegram (and email) login. Run `npm run spike -- keygen` to create Auctra's authorization
   key. Register the public key in the Privy dashboard as a key quorum, and put its ID in `PRIVY_SIGNER_ID`. Run the spike in
   `docs/spike.md` first. It's the go/no-go gate for Privy on Monad Testnet.
2. **Database:** create a Neon database, set `DATABASE_URL`, then run `npm run db:migrate`.
3. **Telegram:** create a bot with @BotFather and set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` and
   `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`. After deploying, register the webhook:
   ```sh
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d url="$NEXT_PUBLIC_APP_URL/api/telegram/webhook" -d secret_token="$TELEGRAM_WEBHOOK_SECRET"
   ```
   In @BotFather, set the bot's Mini App / domain to `NEXT_PUBLIC_APP_URL`.
4. **Claude:** set `ANTHROPIC_API_KEY` (the default model is `claude-opus-5-5`; override it with `ANTHROPIC_MODEL`).
5. **Vercel:** set every variable in `.env.example`, including `CRON_SECRET`. `vercel.json` runs the scheduler every minute,
   which needs the Pro plan. On Hobby, change the schedule to once a day and use **Run now** for demos.

Funding: the user's wallet needs testnet MON (gas) and testnet USDC (Circle faucet). The USDC contract is pinned in
`lib/usdc.ts` and checked on-chain before transfers.
