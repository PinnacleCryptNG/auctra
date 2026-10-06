# Spike: Privy → Monad Testnet USDC transfer

Build step 2 in `docs/PRD.md` §23, and a go/no-go gate. It proves that Auctra's
server can sign a USDC transfer on Monad Testnet through Privy, inside a Privy
policy, using the same code path production will use (`lib/wallet/executor.ts`).

The spike wallet is owned by Auctra's authorization key. That stands in for a
user-owned wallet that has added the same key as a session signer: the
server-side signing request is identical. The user-owned flow is build step 5.

## Prerequisites

- A Privy app (dashboard → App ID and App Secret).
- Testnet MON for gas and testnet USDC (Circle faucet), to fund the spike wallet.
- A second address to receive funds (any wallet you control).

## Steps

```sh
cp .env.example .env.local   # fill NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET
npm install

npm run spike -- keygen
# → copy PRIVY_AUTHORIZATION_PRIVATE_KEY into .env.local (never commit it)

npm run spike -- verify-usdc
# → confirms the RPC is chain 10143 and the USDC contract is 6-decimal USDC

npm run spike -- create-policy --to 0xRECEIVER --max 25
# → policy_id=...

npm run spike -- create-wallet --policy POLICY_ID
# → wallet_id=... address=0x...   (fund this address with MON + USDC)

npm run spike -- balance --address 0xWALLET

npm run spike -- send --wallet-id WALLET_ID --from 0xWALLET --to 0xRECEIVER --amount 1
# → tx_hash, explorer link, receipt status
```

## Pass criteria

Record the results here, including the transaction hashes.

| # | Check | Expected | Result |
|---|---|---|---|
| 1 | `verify-usdc` | symbol USDC, decimals 6 | |
| 2 | `send` 1 USDC to the allowlisted receiver | `status=success`, visible in the explorer | |
| 3 | Re-run the same `send` with `--idempotency-key` from check 2 | no second transfer; same hash or an idempotency error | |
| 4 | `send` to a non-allowlisted address | **refused by Privy policy** | |
| 5 | `send --amount 30` (above the policy's 25 cap; under the app's 100 cap) | **refused by Privy policy** | |
| 6 | `send --amount 1000` | rejected by Auctra before Privy (`INVALID_AMOUNT`) | |

Checks 4 and 5 test the policy only if Auctra's own checks pass first, which is
why check 5 uses an amount under the app cap. For check 4, the app has no
destination allowlist yet, so the request reaches Privy.

Also answer the open questions in PRD §29 (CAIP-2 support, idempotency window,
gas sponsorship) from what you observe.
