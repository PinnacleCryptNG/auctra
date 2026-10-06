# Feasibility: Privy delegated USDC transfers on Monad Testnet

Status: research only. No execution code was written for this report. `docs/PRD.md` is unchanged.

**Question:** can Auctra safely give itself permission to make narrowly scoped USDC transfers from a Privy embedded wallet on Monad Testnet (chain 10143), without ever holding the user's private key?

**Answer:** yes, according to the installed SDKs and Privy's published material, with one design correction (policy ownership, §9) and a live check that this environment could not run (§0).

## 0. Evidence levels

| Level | Meaning |
|---|---|
| **SDK** | Read from the installed type definitions in `node_modules`. Exact. |
| **DOC** | Privy or Circle documentation, seen only through web-search excerpts. The pages themselves are blocked from this environment (`docs.privy.io`, `developers.circle.com` and `testnet-rpc.monad.xyz` all return egress 403). |
| **LIVE** | Run against real Privy or the Monad RPC. **Nothing in this report is LIVE.** There are no credentials here and those hosts are unreachable. |

Installed versions: `@privy-io/react-auth` 3.47.0, `@privy-io/node` 0.35.0 (with `@privy-io/api-types` 0.23.0 and `js-sdk-core` 0.78.0), `viem` 2.57.3.

## 1. Privy SDK capabilities (SDK)

| Need | API | Where |
|---|---|---|
| Embedded wallet (client) | `useWallets()`, `useCreateWallet()`; `PrivyProvider` `embeddedWallets.ethereum.createOnLogin` | react-auth |
| Wallet lookup (server) | `client.wallets().list({ user_id, chain_type })`, `client.wallets().get(id)`, which returns `Wallet { id, address, chain_type, additional_signers[], imported_at, … }` | `resources/wallets/wallets.d.ts:3618` |
| Grant authority (client) | `useSigners().addSigners({ address, signers: [{ signerId, policyIds }] })` (`useSessionSigners` and `useDelegatedActions` are deprecated) | react-auth `index.d.ts:4069` |
| Revoke (client) | `useSigners().removeSigners({ address })` removes **all** signers from the wallet | react-auth `index.d.ts:4089` |
| What the wallet records | `additional_signers: [{ signer_id: KeyQuorumID, override_policy_ids?: [≤1 policy] }]` | `wallets.d.ts:3707-3720` |
| Execution (server) | `client.wallets().ethereum().sendTransaction(walletId, { caip2, params: { transaction }, idempotency_key, reference_id?, sponsor?, authorization_context })` returns `{ caip2, hash, transaction_id?, reference_id? }` | `public-api/services/ethereum.d.ts`, `wallets.d.ts:1140-1200` |
| Request authorization | `authorization_context: { authorization_private_keys \| user_jwts \| signatures \| sign_fns }`. The SDK signs the request (P-256) into the `privy-authorization-signature` header. | `lib/authorization.d.ts` |
| Policies | `client.policies().create/update/get/delete`, `createRule/updateRule/deleteRule`. A policy has `owner` / `owner_id` (key quorum or user). | `resources/policies.d.ts` |
| Idempotency | `privy-idempotency-key`: "ensure API requests are executed only once within a 24-hour window" | `wallets.d.ts:4410` |
| Transaction status | `client.transactions().get(transaction_id)` returns `{ status, transaction_hash }` | `resources/transactions.d.ts` |
| Signing only | `signTransaction`, `signTypedData`, `rawSign` | Not needed |
| **Danger surface** | `exportPrivateKey`, `exportSeedPhrase`, `import` | **Auctra must never call these.** They are also policy methods, so they can be denied. |

The SDK does **not** list supported chains for wallet RPC: `caip2` is typed as a free `string`. The named-chain enums for Privy's high-level `transfer()` action and asset balances do **not** include Monad (`wallets.d.ts:2932, 3747`). Auctra must therefore use the raw `eth_sendTransaction` RPC, not `wallets().transfer()`, and read balances from the Monad RPC. The existing code already does both.

## 2. Monad Testnet compatibility

- **SDK:** `eth_sendTransaction` takes any EIP-155 CAIP-2 string, and the transaction types are standard EVM types (0, 1, 2, 4). Nothing in the SDK excludes `eip155:10143`. Nothing in the SDK confirms it either.
- **DOC:**
  - Privy announced Monad Testnet support for wallets "from day 1" ([Privy on X](https://x.com/privy_io/status/1892231862069690533)).
  - Excerpts from the [eth_sendTransaction reference](https://docs.privy.io/api-reference/wallets/ethereum/eth-send-transaction) say Privy fills in gas, nonce and type, signs, and broadcasts on the given `caip2`. Search excerpts list Monad Testnet (10143) as a supported EVM testnet.
  - [Gas sponsorship](https://docs.privy.io/wallets/gas-and-asset-management/gas/overview) excerpts list Monad and its testnet.
- **LIVE:** not verified.
- **Verdict:** supported according to Privy's own material. It must be proven by a live spike transaction before any execution work (§11, step 1). If that transaction fails, Monad Testnet is not supported for Auctra's purposes, and no RPC or signing workaround will be built.

## 3. Delegated execution mechanism

"Session signers" (react-auth `useSigners`) replace "delegated actions". The flow:

1. **Auctra (once, out of band):** generates a P-256 authorization key pair and registers the **public** key in the Privy dashboard as a key quorum. The quorum's ID is `PRIVY_SIGNER_ID`; the private key is `PRIVY_AUTHORIZATION_PRIVATE_KEY`, stored in server env only.
2. **Auctra server:** creates a policy (§5) for the user's wallet.
3. **User, signed in:** the browser calls `addSigners({ address, signers: [{ signerId: PRIVY_SIGNER_ID, policyIds: [policyId] }] })`. Privy records it on the wallet as `additional_signers[{ signer_id, override_policy_ids }]`. This is the user's explicit consent, and only the wallet owner (the user) can do it.
4. **Auctra server:** reads `wallets().get(id).additional_signers` and confirms that its signer is present **with** the policy before recording `GRANTED`. This already exists in `app/api/onboarding/signer/route.ts`.
5. **Later, user offline:** the server calls `sendTransaction(..., authorization_context: { authorization_private_keys: [key] })`. Privy checks the authorization signature, evaluates the signer's override policy, then signs in its secure enclave and broadcasts.
6. **Revoke:**
   - The user calls `removeSigners`. Privy then refuses requests at its end.
   - Auctra also marks `REVOKED` and fails closed with `MISSING_PERMISSION`.
   - Because Auctra sets `REVOKED` from a browser call, it should also re-check `additional_signers` before each execution, or at least on each `MISSING_PERMISSION`-type error from Privy.

**Auctra never receives the wallet key at any point.** The authorization key only authorizes requests to Privy; it cannot produce a blockchain signature.

## 4. Authorization mechanism (summary)

| Question | Answer |
|---|---|
| Who creates it | The user, via `addSigners` in the browser (owner consent) |
| Where it is stored | On the Privy wallet: `additional_signers[]`. Auctra stores only `signer_status` and `privy_policy_id`. |
| Identifier | Key quorum ID (`PRIVY_SIGNER_ID`) plus policy ID (`wallets.privy_policy_id`) |
| Scope | One override policy per signer (`override_policy_ids` takes at most one, per `wallets.d.ts:3717`) |
| Can it restrict contract / address / function / value | Yes (§5) |
| Revocation | `removeSigners({ address })`, which removes all signers. A policy can also expire on its own (§5). |
| Server credentials | `PRIVY_APP_SECRET` (basic auth) plus `PRIVY_AUTHORIZATION_PRIVATE_KEY` (request signature) |
| Execution API | `wallets().ethereum().sendTransaction` (`POST /v1/wallets/{id}/rpc`, `eth_sendTransaction`) |

## 5. Spending policy capabilities

Condition types come from `policies.d.ts` (SDK). Calldata field syntax (`function.param`) comes from DOC ([Ethereum examples](https://docs.privy.io/controls/policies/example-policies/ethereum)).

| Restriction | Privy-enforced? | How |
|---|---|---|
| Network | **Privy** | `ethereum_transaction.chain_id eq "10143"` |
| Token contract | **Privy** | `ethereum_transaction.to eq <USDC>` |
| Function | **Privy** | `ethereum_calldata` with the ERC-20 `transfer` ABI. A field `transfer.*` only decodes `transfer(address,uint256)`. |
| Destination | **Privy** | `ethereum_calldata transfer.recipient in [...]`. viem's `erc20Abi` names the inputs `recipient` and `amount`, which matches the existing `buildUsdcTransferPolicy`. |
| Amount per transfer | **Privy** | `transfer.amount lte <units>` |
| Native value | **Privy** (should be added) | `ethereum_transaction.value eq "0x0"`. The current policy relies only on `to = USDC`. |
| Grant expiry | **Privy** (optional) | `system.current_unix_timestamp lte <t>` |
| Deny export, raw sign and other methods | **Privy**, if the engine is default-deny | DOC says DENY rules win over ALLOW and that "operations that don't match any policies follow the default behavior". **Default-deny is not confirmed; it must be tested live** (send MON, call `approve`). |
| Rolling daily cap | **Not by Privy for `eth_sendTransaction`** | Aggregations (`aggregations.d.ts`) only support `eth_signTransaction` / `eth_signUserOperation`, and the SDK `Aggregations` class exposes no methods. → **Auctra** (`DAILY_CAP`) |
| Frequency, schedule, "only when due" | **Not enforceable** by Privy | **Auctra** (scheduler, execution keys, unique constraint) |
| Balance conditions, floor | **Not enforceable** by Privy | **Auctra** preflight |
| Destination belongs to *this* automation | **Not enforceable**: the policy is per-wallet, not per-automation | **Auctra** |
| Duplicate submission | **Privy** for 24 h via the idempotency key, plus **Auctra**'s DB unique key | Both |

The policy can only check what is in the call; it is not a statement about the UI. Anything the UI shows (schedule, memo, conditions) beyond the rows marked "Privy" above is enforced only by Auctra.

## 6. Monad Testnet USDC

| Field | Value | Evidence |
|---|---|---|
| Address | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | SDK-adjacent: viem 2.57.3 canonical USDC map, `node_modules/viem/_esm/tokens/definitions/usdc.js:63` (`10143: … // monadTestnet`). DOC: search excerpts of [Circle's USDC addresses page](https://developers.circle.com/stablecoins/usdc-contract-addresses) give the same address. It matches PRD §17 and `lib/network`. |
| Decimals | 6 | DOC (Circle) plus PRD. Not checked on-chain from here. |
| Standard | Circle FiatToken (ERC-20 `transfer(address,uint256) returns (bool)`) | DOC. Note: FiatToken can pause and blacklist, so a transfer can revert and be recorded as `FAILED`. |
| Policy-constrainable | Yes: `to` = this address plus calldata conditions (§5) | SDK |
| Faucet | Circle faucet (DOC) | Not verified |

**Not verified on-chain:** the Monad RPC is blocked here. The existing fail-closed check (`symbol() == "USDC"` and `decimals() == 6` before execution, PRD §17) stays mandatory. A suitable authoritative contract does exist; nothing suggests otherwise.

## 7. Proposed transaction flow (smallest safe version)

| # | Step | Component |
|---|---|---|
| 1 | User grants: `addSigners` with Auctra's quorum plus its policy | Browser (react-auth), onboarding/settings |
| 2 | Verify the signer and policy on the wallet; store `signer_status=GRANTED` and `privy_policy_id` | `app/api/onboarding/signer` |
| 3 | Automation created after deterministic confirmation | `lib/services/automations.ts`, `confirmations.ts` |
| 4 | Due automation selected; execution row reserved (`execution_key` unique) | `app/api/cron/execute` → `lib/services/executions.ts` |
| 5 | Preflight: chain, asset, destination, amount, caps, balance, floor, status, signer. On-chain `symbol`/`decimals`/`balanceOf` via the Monad RPC | `lib/wallet/executor.ts`, `lib/services/executions.ts` |
| 6 | Build `transfer(recipient, amount)` calldata to the USDC constant, chain 10143, value 0 | `lib/wallet/executor.ts` |
| 7 | `sendTransaction(walletId, { caip2: "eip155:10143", idempotency_key: execution_key, reference_id: execution_key, authorization_context })`; Privy checks the policy, signs and broadcasts | `lib/wallet/privy.ts` → Privy |
| 8 | Store `tx_hash`, mark `SUBMITTED` | `executions.ts` |
| 9 | Receipt via the Monad RPC (`waitForTransactionReceipt`), mark `CONFIRMED` or `FAILED`; otherwise `UNKNOWN` per §10 | `executions.ts`, `lib/chain` |
| 10 | Audit plus notification | `audit.ts`, `notifications.ts` |

Steps 3–10 already exist in the MVP code and are tested against a **simulated** signer. They have never run against real Privy. The next phase verifies them; it does not rewrite them.

## 8. Required environment variables

- **Execution (server only):**
  - `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`
  - `PRIVY_AUTHORIZATION_PRIVATE_KEY` (base64 PKCS8 P-256, per `lib/authorization.d.ts`)
  - `PRIVY_SIGNER_ID`
  - `DATABASE_URL`, `CRON_SECRET`
  - `AUCTRA_NETWORK=testnet`, `MONAD_CHAIN_ID=10143`, `MONAD_RPC_URL`
- **Privy dashboard:**
  - register the authorization public key as a key quorum;
  - enable embedded wallets;
  - turn on gas sponsorship for Monad Testnet, or fund each wallet with MON.
- **Spike only (never committed):** a test user's wallet ID and a funded test wallet.

## 9. Security review

| Would the design require… | Answer |
|---|---|
| User private key | No |
| Seed phrase | No (export methods exist in the SDK; Auctra never calls them, and the policy should deny them) |
| Browser-held signing secret | No. `addSigners` uses the user's Privy session, and Privy holds the key. |
| Server-held **user wallet** credential | No |
| Raw signer secret | **One app-level secret:** `PRIVY_AUTHORIZATION_PRIVATE_KEY`. It is Auctra's own request-signing key, not a wallet key, and is the exception already allowed by PRD §7.1. It cannot sign blockchain transactions; it can only ask Privy to, within policy. |

No STOP condition is triggered. But two findings are real:

1. **Policy ownership (design flaw in the current code and PRD):**
   - `syncTransferPolicy` creates the policy with `owner_id = PRIVY_SIGNER_ID`, so the policy is owned by the same key that executes. Auctra can therefore rewrite its own limits (destinations, cap, chain) without the user.
   - Whoever holds `PRIVY_AUTHORIZATION_PRIVATE_KEY` could rewrite the policy and then drain the wallet. PRD §26 claims the policy "limits the damage" of a key leak; that is false as built.
   - **Fix:** make the policy **owned by the user** (`owner: { user_id }`, per `PolicyCreateParams.owner`), so every policy change needs the user's authorization. In the browser, the user signs the update (`useAuthorizationSignature`, or the user JWT in `authorization_context.user_jwts`).
   - Effect: adding or removing a destination re-scopes the policy only with the user present (web step). A leaked server key is then truly limited to the user-approved scope.
   - This must be **verified live**: a signer-key `policies().update` must be refused.
2. **Default-deny not confirmed.** If Privy's default for unmatched requests were "allow", the policy would not block MON transfers or other methods. Add explicit DENY rules (`exportPrivateKey`, `exportSeedPhrase`, `*`), or prove default-deny live before any real funds are involved.

Other risks:
- `removeSigners` removes **all** signers, which is fine for Auctra.
- `REVOKED` is client-reported, so the server should re-check before executing.
- Testnet only, so funds at risk are test tokens.
- Keep the authorization key out of logs and errors: `PrivyNotConfiguredError` already reports names only.

## 10. PRD compatibility

**A. Fully compatible:**
- §7.1 (one app-level key);
- §7.2 session signers plus the policy, user consent and revoke;
- §7.3 Layer 2 conditions: chain, `to`, `transfer` function, recipient allowlist, per-transfer cap;
- §10 idempotency key, now confirmed as a 24 h window (SDK), which answers §29 Q3;
- §17 USDC constant;
- the CAIP-2 `eip155:10143` request shape.

**B. Need clarification:**
- §29 Q1: Monad Testnet on `eth_sendTransaction` is DOC-supported and must be proven LIVE.
- §29 Q2: the `transfer.recipient` / `transfer.amount` syntax matches DOC; refusal must be proven LIVE.
- §29 Q4: Privy login inside a Telegram Mini App is untested.
- §29 Q5: DOC lists gas sponsorship for Monad Testnet; the assumption "user holds MON" can stay as the fallback.
- §7.3's "everything else is denied" depends on default-deny (see §9).

**C. Impossible as written:**
- §7.3 implies the 250 USDC **daily cap** is part of the protection. Privy cannot enforce a rolling cap on `eth_sendTransaction` (aggregations are sign-only), so it is Auctra-only. The PRD's Layer 1 table already puts it there; no PRD Layer 2 claim needs to change, but it must not be described to users as Privy-enforced.
- §26 "Authorization key leak → policy limits the damage" is impossible while the signer owns the policy.

**D. PRD changes needed (proposed, not applied):**
1. §7.2 / §7.3: the policy is **user-owned**; destination changes require a user-signed policy update in the web step. Telegram can save a destination as "pending" and link to the web to approve it.
2. §7.3 Layer 2: add `value = 0`, explicit DENY rules for export methods, and optionally an expiry condition.
3. §17: `PRIVY_SIGNER_ID` is the session signer only, not the "policy owner".
4. §26: restate the key-leak mitigation (only true with a user-owned policy).
5. §29: mark Q3 answered (24 h).

## 11. Decision and next-phase sequence

The verdict is GO, conditional on the live spike in step 1. Every step is a gate.

1. **Live spike (no product code), using a real Privy app, the authorization key and a funded test embedded wallet on Monad Testnet:**
   - (a) `sendTransaction` USDC `transfer` on `eip155:10143` succeeds and confirms;
   - (b) a non-allowlisted recipient is refused;
   - (c) an over-cap amount is refused;
   - (d) a MON value transfer and an `approve` call are refused (default-deny);
   - (e) the same idempotency key does not double-send;
   - (f) after `removeSigners`, requests are refused;
   - (g) with a user-owned policy, `policies().update` signed only by the server key is refused;
   - (h) on-chain `symbol`/`decimals` of `0x534b…43A3` return `USDC` / `6`.
   - Extend the existing `npm run test:integration` suite for this; it skips without credentials.
2. Switch policy ownership to the user. Add `value = 0`, DENY export rules and the user-signed update flow for destination changes (web).
3. Before each execution, re-check `additional_signers` server-side.
4. Run the existing executor against real Privy through the integration suite: Run Now first, then cron.
5. Update PRD §7 / §17 / §26 / §29 per §10.D, with user approval, since the PRD is frozen.

**If step 1(a) fails** (Monad Testnet unsupported for server `eth_sendTransaction`), the smallest change that keeps the thesis is a **Privy server wallet per account** (created by the server with `wallets().create`, owned by a user key quorum and governed by the same policy). The user funds it from their embedded wallet. Only if Privy cannot sign for 10143 at all does the wallet provider decision (frozen) need revisiting; Auctra must not substitute its own key management.

GO — the proposed Auctra execution model is technically feasible.
