// Unit tests of the REAL route handlers with Privy replaced by a fake verifier
// and a fake wallet list. These prove Auctra's own rules (who may call what,
// what gets stored). They do NOT prove Privy itself works: see
// tests/integration/privy.integration.test.ts for that.

import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/client";
import { users, wallets } from "../db/schema";
import { createTestDb } from "./helpers/db";

const state = vi.hoisted(() => ({
  db: null as unknown as Db,
  tokens: new Map<string, string>(), // access token -> Privy user ID
  privyWallets: [] as Array<{ id: string; address: string; chain_type: string; archived_at: number | null; imported_at: number | null }>,
  configured: true
}));

vi.mock("@/db/client", () => ({ getDb: () => state.db }));
vi.mock("@/lib/app/runtime", async () => {
  const { PrivyNotConfiguredError } = await import("../lib/wallet/privy");
  return {
    getPrivyClient: () => {
      if (!state.configured) throw new PrivyNotConfiguredError(["PRIVY_APP_SECRET"]);
      return {
        utils: () => ({
          auth: () => ({
            verifyAccessToken: async (token: string) => {
              const userId = state.tokens.get(token);
              if (!userId) throw new Error("invalid token");
              return { user_id: userId };
            }
          })
        }),
        wallets: () => ({
          list: async function* (params: { user_id: string }) {
            if (params.user_id === "did:privy:alice") yield* state.privyWallets;
          }
        })
      };
    }
  };
});

const { POST: session } = await import("../app/api/auth/session/route");
const { POST: registerWalletRoute } = await import("../app/api/onboarding/wallet/route");
const { POST: createAccountRoute } = await import("../app/api/onboarding/account/route");
const { GET: me } = await import("../app/api/me/route");
const { POST: runNowRoute } = await import("../app/api/automations/[id]/run/route");

const call = (handler: (req: Request, ctx: { params: Promise<never> }) => Promise<Response>, token?: string, body?: unknown, params: object = {}) =>
  handler(
    new Request("http://test/api", {
      method: "POST",
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    { params: Promise.resolve(params as never) }
  );

const EMBEDDED = { id: "cm-wallet-1", address: "0x71c9a3f9c21b04de8a5c6f1e2d3b4a5968778992", chain_type: "ethereum", archived_at: null, imported_at: null };

beforeEach(async () => {
  state.db = await createTestDb();
  state.tokens = new Map([["alice-token", "did:privy:alice"]]);
  state.privyWallets = [EMBEDDED];
  state.configured = true;
  vi.stubEnv("AUCTRA_NETWORK", "testnet");
  vi.stubEnv("MONAD_CHAIN_ID", "10143");
});
afterEach(() => vi.unstubAllEnvs());

describe("unauthenticated access (unit, real route handlers)", () => {
  it("rejects requests with no token", async () => {
    for (const handler of [session, registerWalletRoute, createAccountRoute, me]) {
      expect((await call(handler)).status).toBe(401);
    }
  });

  it("rejects invalid tokens without touching the database", async () => {
    const res = await call(registerWalletRoute, "forged-token");
    expect(res.status).toBe(401);
    expect(await state.db.select().from(users)).toHaveLength(0);
  });

  it("cannot run a financial operation without signing in", async () => {
    const res = await call(runNowRoute, undefined, { requestId: "request-0001" }, { id: "00000000-0000-4000-8000-000000000000" });
    expect(res.status).toBe(401);
  });
});

describe("sign-in → Auctra user → wallet (unit, real route handlers)", () => {
  it("creates exactly one Auctra user for a verified Privy login", async () => {
    expect((await call(session, "alice-token")).status).toBe(200);
    expect((await call(session, "alice-token")).status).toBe(200);
    const rows = await state.db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(rows[0].privyUserId).toBe("did:privy:alice");
  });

  it("stores only safe wallet metadata on Monad Testnet", async () => {
    await call(session, "alice-token");
    await call(createAccountRoute, "alice-token", { type: "INDIVIDUAL", timezone: "UTC" });
    const res = await call(registerWalletRoute, "alice-token");
    expect(res.status).toBe(200);

    const [row] = await state.db.select().from(wallets);
    expect(row.privyWalletId).toBe("cm-wallet-1");
    expect(row.address).toBe(getAddress(EMBEDDED.address));
    expect(row.chainId).toBe(10143);
    expect(row.signerStatus).toBe("NOT_GRANTED");

    const body = await (await call(me, "alice-token")).json();
    expect(body.wallet).toEqual({ address: row.address, chainId: 10143, signerStatus: "NOT_GRANTED", permission: "NOT_GRANTED", balanceFloor: null });
  });

  it("refuses wallets imported from a private key", async () => {
    state.privyWallets = [{ ...EMBEDDED, imported_at: 1_700_000_000 }];
    await call(session, "alice-token");
    await call(createAccountRoute, "alice-token", { type: "INDIVIDUAL", timezone: "UTC" });
    const res = await call(registerWalletRoute, "alice-token");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("WALLET_NOT_READY");
    expect(await state.db.select().from(wallets)).toHaveLength(0);
  });

  it("requires an account before a wallet can be connected", async () => {
    await call(session, "alice-token");
    const res = await call(registerWalletRoute, "alice-token");
    expect((await res.json()).error.code).toBe("NO_ACCOUNT");
  });

  it("refuses to register when the server isn't locked to Monad Testnet", async () => {
    vi.stubEnv("MONAD_CHAIN_ID", "143"); // testnet-guard-ignore
    await call(session, "alice-token");
    await call(createAccountRoute, "alice-token", { type: "INDIVIDUAL", timezone: "UTC" });
    const res = await call(registerWalletRoute, "alice-token");
    expect(res.status).toBe(503);
    expect(await state.db.select().from(wallets)).toHaveLength(0);
  });

  it("reports missing Privy configuration as 503 without leaking details", async () => {
    state.configured = false;
    const res = await call(session, "alice-token");
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toContain("NOT_CONFIGURED");
    expect(text).not.toContain("PRIVY_APP_SECRET");
  });
});
