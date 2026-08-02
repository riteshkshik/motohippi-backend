try {
  process.loadEnvFile();
} catch {
  // .env file is optional when environment variables are passed directly
}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a PostgreSQL database?"
  );
}

const useSsl =
  process.env.NODE_ENV === "production" ||
  process.env.DATABASE_URL?.includes("railway") ||
  process.env.DATABASE_URL?.includes("sslmode=");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema/index.js";
