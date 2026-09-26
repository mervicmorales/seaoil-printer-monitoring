import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const configuredPoolMax = Number(process.env.DB_POOL_MAX);
const poolMax = Number.isInteger(configuredPoolMax) && configuredPoolMax >= 1 && configuredPoolMax <= 20
  ? configuredPoolMax
  : 10;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    max: poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
