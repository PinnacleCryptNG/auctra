import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { getDb, type Db } from "../../db/client";
import { getAccountContext, type AccountContext } from "../services/accounts";
import { UserFacingError } from "../services/errors";
import { getPrivy } from "./runtime";

export type AuthedContext = { db: Db; privyUserId: string; ctx: AccountContext | null };

export function errorResponse(error: unknown) {
  if (error instanceof UserFacingError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.code === "NOT_FOUND" ? 404 : 400 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: error.issues[0]?.message ?? "Invalid request." } }, { status: 400 });
  }
  console.error("API error", error);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong." } }, { status: 500 });
}

/** Verifies the Privy access token (Authorization: Bearer) and loads the caller's account. */
export async function authenticate(request: Request): Promise<AuthedContext | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const claims = await getPrivy().client.utils().auth().verifyAccessToken(token);
    const db = getDb();
    return { db, privyUserId: claims.user_id, ctx: await getAccountContext(db, { privyUserId: claims.user_id }) };
  } catch {
    return null;
  }
}

type Handler<P> = (auth: AuthedContext, request: Request, params: P) => Promise<Response>;

export function withAuth<P = Record<string, never>>(handler: Handler<P>) {
  return async (request: Request, context: { params: Promise<P> }) => {
    try {
      const auth = await authenticate(request);
      if (!auth) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Please log in again." } }, { status: 401 });
      return await handler(auth, request, await context.params);
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
