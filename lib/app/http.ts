import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { getDb, type Db } from "../../db/client";
import { getAccountContext, type AccountContext } from "../services/accounts";
import { UserFacingError } from "../services/errors";
import { ConfigurationError } from "../config";
import { getPrivyClient } from "./runtime";

export type AuthedContext = { db: Db; privyUserId: string; ctx: AccountContext | null };

export function errorResponse(error: unknown) {
  if (error instanceof ConfigurationError) {
    // Names of the missing variables go to the server log only; never values.
    console.error(error.message);
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "Wallet sign-in isn't set up on this server yet." } },
      { status: 503 }
    );
  }
  if (error instanceof UserFacingError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "AI_UNAVAILABLE" || error.code === "AUTH_UNAVAILABLE" ? 503 : 400;
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: error.issues[0]?.message ?? "Invalid request." } }, { status: 400 });
  }
  console.error("API error", error);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong." } }, { status: 500 });
}

export type AuthDeps = {
  /** Verifies a Privy access token and returns its Privy user ID; throws if invalid. */
  verifyAccessToken: (token: string) => Promise<{ user_id: string }>;
  db: Db;
};

function productionAuthDeps(): AuthDeps {
  const client = getPrivyClient();
  return { verifyAccessToken: (token) => client.utils().auth().verifyAccessToken(token), db: getDb() };
}

/**
 * Verifies the Privy access token (Authorization: Bearer) and loads the
 * caller's Auctra account. Returns null for a missing or invalid token.
 * Missing server configuration is NOT treated as a bad token: it throws.
 */
export async function authenticate(request: Request, deps?: AuthDeps): Promise<AuthedContext | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;
  const { verifyAccessToken, db } = deps ?? productionAuthDeps();
  let privyUserId: string;
  try {
    privyUserId = (await verifyAccessToken(token)).user_id;
  } catch (error) {
    // Privy's signing keys couldn't be fetched: the token may be fine, so don't tell the user their session ended.
    if (isVerifierUnavailable(error)) {
      console.error("Couldn't fetch Privy's token keys", error);
      throw new UserFacingError("AUTH_UNAVAILABLE", "Couldn't check your sign-in just now. Try again in a moment.");
    }
    return null;
  }
  if (!privyUserId) return null;
  return { db, privyUserId, ctx: await getAccountContext(db, { privyUserId }) };
}

/** jose's errors for a JWKS fetch that timed out or got a bad response, and fetch's own network error. */
function isVerifierUnavailable(error: unknown) {
  if (error instanceof TypeError) return true;
  const code = (error as { code?: unknown } | null)?.code;
  return code === "ERR_JWKS_TIMEOUT" || code === "ERR_JOSE_GENERIC";
}

type Handler<P> = (auth: AuthedContext, request: Request, params: P) => Promise<Response>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function withAuth<P = Record<string, never>>(handler: Handler<P>) {
  return async (request: Request, context: { params: Promise<P> }) => {
    try {
      const auth = await authenticate(request);
      if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Please log in again." } }, { status: 401 });
      const params = await context.params;
      // Record IDs are UUIDs: anything else can't exist, so answer 404 before it reaches the database.
      const id = (params as { id?: unknown } | undefined)?.id;
      if (id !== undefined && (typeof id !== "string" || !UUID.test(id))) throw new UserFacingError("NOT_FOUND", "Not found.");
      return await handler(auth, request, params);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Requires a linked user with an account and wallet. */
export function requireReady(auth: AuthedContext) {
  const ctx = auth.ctx;
  if (!ctx) throw new UserFacingError("NOT_LINKED", "Open Auctra from Telegram with /start to link your account.");
  if (!ctx.account) throw new UserFacingError("NO_ACCOUNT", "Finish setting up your account first.");
  if (!ctx.wallet) throw new UserFacingError("NO_WALLET", "Finish setting up your wallet first.");
  return { ...ctx, account: ctx.account, wallet: ctx.wallet };
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const body = await request.json().catch(() => {
    throw new UserFacingError("INVALID_REQUEST", "Request body must be JSON.");
  });
  return schema.parse(body);
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
