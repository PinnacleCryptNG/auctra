import { readdirSync, readFileSync } from "node:fs";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../db/schema";

// PRD §7.1 / §18: no column may hold keys, seeds or credentials.
const FORBIDDEN = /(private|secret|seed|mnemonic|passphrase|signing|signer_key|credential|access_token|refresh_token|password|api_key|auth_token)/i;

const tables = Object.values(schema).filter((value) => is(value, PgTable)) as PgTable[];

describe("database schema holds no signing material (unit)", () => {
  it("has no credential-like column in any table", () => {
    expect(tables.length).toBeGreaterThan(5);
    const offending = tables.flatMap((table) =>
      Object.values(getTableColumns(table))
        .map((column) => `${getTableName(table)}.${column.name}`)
        .filter((name) => FORBIDDEN.test(name))
    );
    expect(offending).toEqual([]);
  });

  it("no migration adds such a column", () => {
    const sql = readdirSync("drizzle")
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(`drizzle/${f}`, "utf8"))
      .join("\n");
    const columns = [...sql.matchAll(/"([a-z_]+)" (?:text|varchar|jsonb|uuid|numeric|integer|bigint|timestamp)/g)].map((m) => m[1]);
    expect(columns.length).toBeGreaterThan(20);
    expect(columns.filter((c) => FORBIDDEN.test(c))).toEqual([]);
  });

  it("wallets store only Privy wallet ID, address, chain and status metadata", () => {
    expect(Object.values(getTableColumns(schema.wallets)).map((c) => c.name).sort()).toEqual(
      ["account_id", "address", "balance_floor", "chain_id", "created_at", "id", "policy_fingerprint", "privy_policy_id", "privy_wallet_id", "signer_status", "status"].sort()
    );
  });
});
