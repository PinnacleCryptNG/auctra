import { neon } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Services take a Db so tests can run them against PGlite with the real migrations.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Db | undefined;

export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured.");
    cached = drizzle(neon(url), { schema }) as unknown as Db;
  }
  return cached;
}

export { schema };
