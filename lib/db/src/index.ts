import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function createPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  // Parse connection string to detect SSL requirement (common on Render, Railway, etc.)
  const needsSsl = databaseUrl.includes("amazonaws.com") ||
    databaseUrl.includes("render.com") ||
    databaseUrl.includes("railway.app") ||
    databaseUrl.includes("supabase.co") ||
    process.env.DATABASE_SSL === "true";

  return new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_MAX ?? "20"),
    idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_MS ?? "30_000"),
    connectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONN_TIMEOUT_MS ?? "5_000"),
    ssl: needsSsl
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

let poolInstance: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!poolInstance) {
    poolInstance = createPool();
  }
  return poolInstance;
}

export const pool = getPool();
export const db = drizzle(pool, { schema });

export * from "./schema";
