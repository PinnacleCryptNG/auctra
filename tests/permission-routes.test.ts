// Unit tests of the REAL permission route handlers (review → approve → verify)
// with Privy replaced by an in-memory fake. They prove Auctra's rules: the
// policy is created user-owned, nothing is recorded until Privy's own records
// match, Auctra never edits a policy, and changed limits make the grant stale.
// They do NOT prove Privy enforces anything: see tests/integration/.

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/client";
import { users, wallets } from "../db/schema";
import { getAccountContext } from "../lib/services/accounts";
import { confirmDestination, proposeDestination } from "../lib/services/destinations";
import { createTestDb } from "./helpers/db";

const SIGNER_ID = "auctra-key-quorum";
const WALLET = { id: "cm-wallet-1", address: "0x71c9a3f9c21b04de8a5c6f1e2d3b4a5968778992", chain_type: "ethereum", archived_at: null, imported_at: null };

type FakePolicy = { id: string; chain_type: string; owner_id: string | null; rules: unknown[]; owner?: unknown };

const state = vi.hoisted(() => ({
  db: null as unknown as Db,
  signers: [] as Array<{ signer_id: string; override_policy_ids?: string[] }>,
  policies: new Map<string, FakePolicy>(),
  created: [] as Array<Record<string, unknown>>,
  policyUpdates: 0
}));

vi.mock("@/db/client", () => ({ getDb: () => state.db }));
vi.mock("@/lib/wallet/privy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/wallet/privy")>();
  const fakeClient = {
    utils: () => ({
      auth: () => ({
        verifyAccessToken: async (token: string) => {
          if (token !== "alice-token") throw new Error("invalid token");
          return { user_id: "did:privy:alice" };
        }
      })
    }),
    wallets: () => ({
      list: async function* () {
        yield { ...WALLET, additional_signers: state.signers };
      },
      get: async (id: string) => {
        if (id !== WALLET.id) throw new Error("not found");
        return { ...WALLET, additional_signers: state.signers };
      }
    }),
    policies: () => ({
      create: async (params: Record<string, unknown>) => {
        state.created.push(params);
        const owner = params.owner as { user_id?: string } | undefined;
        const policy: FakePolicy = {
          id: `policy-${state.created.length}`,
          chain_type: params.chain_type as string,
          // Privy represents the owner as a key quorum ID; a user owner is not Auctra's quorum.
          owner_id: owner?.user_id ? `user-quorum:${owner.user_id}` : ((params.owner_id as string | undefined) ?? null),
          rules: params.rules as unknown[]
        };
        state.policies.set(policy.id, policy);
        return policy;
      },
      get: async (id: string) => {
        const policy = state.policies.get(id);
        if (!policy) throw new Error("not found");
        return policy;
      },
      update: async () => {
        state.policyUpdates += 1;
        throw new Error("Auctra must never update a policy");
      }
    })
  };
  return { ...actual, createPrivyClient: () => fakeClient };
});

const { POST: session } = await import("../app/api/auth/session/route");
const { POST: createAccountRoute } = await import("../app/api/onboarding/account/route");
const { POST: registerWalletRoute } = await import("../app/api/onboarding/wallet/route");
const signerRoute = await import("../app/api/onboarding/signer/route");
const { GET: me } = await import("../app/api/me/route");

const call = (handler: (req: Request, ctx: { params: Promise<never> }) => Promise<Response>, method = "POST", body?: unknown) =>
  handler(
    new Request("http://test/api", {
      method,
      headers: { authorization: "Bearer alice-token", "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    { params: Promise.resolve({} as never) }
  );

const permission = async () => (await (await call(me, "GET")).json()).wallet.permission;

async function addDestination(address: string, label: string) {
  const [user] = await state.db.select().from(users).where(eq(users.privyUserId, "did:privy:alice"));
  const ctx = (await getAccountContext(state.db, { userId: user.id }))!;
  const proposal = await proposeDestination(state.db, {
    userId: user.id,
    accountId: ctx.account!.id,
    walletAddress: ctx.wallet!.address,
    label,
    address,
    category: "SAVINGS"
  });
  await confirmDestination(state.db, { confirmationId: proposal.confirmationId, userId: user.id, accountId: ctx.account!.id });
}

/** What the user's browser does on "Approve": Privy addSigners with Auctra's signer + policy. */
const userApproves = (policyId: string) => {
  state.signers = [{ signer_id: SIGNER_ID, override_policy_ids: [policyId] }];
};

beforeEach(async () => {
  state.db = await createTestDb();
  state.signers = [];
  state.policies = new Map();
  state.created = [];
  state.policyUpdates = 0;
  vi.stubEnv("AUCTRA_NETWORK", "testnet");
  vi.stubEnv("MONAD_CHAIN_ID", "10143");
  // Placeholders: the Privy client is faked above, nothing reaches Privy.
  vi.stubEnv("NEXT_PUBLIC_PRIVY_APP_ID", "test-app-id");
  vi.stubEnv("PRIVY_APP_SECRET", "test-placeholder");
  vi.stubEnv("PRIVY_SIGNER_ID", SIGNER_ID);

  await call(session);
  await call(createAccountRoute, "POST", { type: "INDIVIDUAL", timezone: "UTC" });
  expect((await call(registerWalletRoute)).status).toBe(200);
  await addDestination("0x2222222222222222222222222222222222222222", "Savings");
});
afterEach(() => vi.unstubAllEnvs());

describe("authorization lifecycle (unit, real route handlers, fake Privy)", () => {
  it("review creates a USER-owned policy with the hardened limits", async () => {
    const res = await call(signerRoute.GET, "GET");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ signerId: SIGNER_ID, permission: "NOT_GRANTED", review: { chainId: 10143, asset: "USDC", contract: "0x534b2f3A21130d7a60830c2Df862319e593943A3" } });
    expect(body.review.recipients).toEqual([{ label: "Savings", address: "0x2222222222222222222222222222222222222222" }]);

    expect(state.created).toHaveLength(1);
    expect(state.created[0].owner).toEqual({ user_id: "did:privy:alice" });
    expect(state.created[0]).not.toHaveProperty("owner_id");
    expect(await permission()).toBe("NOT_GRANTED");
  });

  it("is not READY until Privy's records show the signer bound to that policy", async () => {
    const { policyId } = await (await call(signerRoute.GET, "GET")).json();

    // The browser claims it approved, but the wallet has no Auctra signer.
    const early = await call(signerRoute.POST, "POST", { action: "granted", policyId });
    expect(early.status).toBe(400);
    expect((await early.json()).error.code).toBe("PERMISSION_SIGNER_MISSING");
    expect(await permission()).toBe("NOT_GRANTED");

    userApproves(policyId);
    const ok = await call(signerRoute.POST, "POST", { action: "granted", policyId });
    expect(ok.status).toBe(200);
    expect(await permission()).toBe("VERIFIED");
    const [wallet] = await state.db.select().from(wallets);
    expect(wallet).toMatchObject({ signerStatus: "GRANTED", privyPolicyId: policyId });
    expect(wallet.policyFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a policy that is not the one attached to the wallet", async () => {
    const { policyId } = await (await call(signerRoute.GET, "GET")).json();
    userApproves(policyId);
    const res = await call(signerRoute.POST, "POST", { action: "granted", policyId: "policy-forged" });
    expect((await res.json()).error.code).toBe("PERMISSION_POLICY_NOT_ATTACHED");
    expect(await permission()).toBe("NOT_GRANTED");
  });

  it("refuses a policy owned by Auctra's own signer", async () => {
    state.policies.set("policy-auctra-owned", { id: "policy-auctra-owned", chain_type: "ethereum", owner_id: SIGNER_ID, rules: [] });
    const { policyId } = await (await call(signerRoute.GET, "GET")).json();
    // Same rules as the real one, but Auctra could rewrite it.
    state.policies.set("policy-auctra-owned", { ...state.policies.get(policyId)!, id: "policy-auctra-owned", owner_id: SIGNER_ID });
    userApproves("policy-auctra-owned");
    const res = await call(signerRoute.POST, "POST", { action: "granted", policyId: "policy-auctra-owned" });
    expect((await res.json()).error.code).toBe("PERMISSION_POLICY_NOT_USER_OWNED");
    expect(await permission()).toBe("NOT_GRANTED");
  });

  it("changing destinations makes the grant STALE without Auctra touching the policy", async () => {
    const { policyId } = await (await call(signerRoute.GET, "GET")).json();
    userApproves(policyId);
    await call(signerRoute.POST, "POST", { action: "granted", policyId });
    expect(await permission()).toBe("VERIFIED");

    await addDestination("0x3333333333333333333333333333333333333333", "Vendor");
    expect(await permission()).toBe("STALE");
    expect(state.policyUpdates).toBe(0);

    // Re-approving the OLD policy no longer verifies: its limits are out of date.
    const old = await call(signerRoute.POST, "POST", { action: "granted", policyId });
    expect((await old.json()).error.code).toBe("PERMISSION_POLICY_MISMATCH");

    // Review creates a NEW user-owned policy; approving it verifies again.
    const { policyId: next } = await (await call(signerRoute.GET, "GET")).json();
    expect(next).not.toBe(policyId);
    userApproves(next);
    expect((await call(signerRoute.POST, "POST", { action: "granted", policyId: next })).status).toBe(200);
    expect(await permission()).toBe("VERIFIED");
    expect(state.policyUpdates).toBe(0);
  });

  it("revoked signer is not READY", async () => {
    const { policyId } = await (await call(signerRoute.GET, "GET")).json();
    userApproves(policyId);
    await call(signerRoute.POST, "POST", { action: "granted", policyId });
    state.signers = [];
    expect((await call(signerRoute.POST, "POST", { action: "revoked" })).status).toBe(200);
    expect(await permission()).toBe("REVOKED");
  });
});
