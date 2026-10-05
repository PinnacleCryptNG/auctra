# Auctra

Autonomous financial agent for recurring and conditional onchain money movement.

**MVP network:** Monad Testnet only (chain ID 10143)

**Primary interface:** Telegram

See the frozen product specification in `docs/PRD.md`.

## Development

```sh
npm install
npm run check:testnet   # fails on any Monad mainnet reference
npm run lint            # typecheck
npm test                # unit tests
```

The Privy → Monad Testnet USDC spike is described in `docs/spike.md`.
