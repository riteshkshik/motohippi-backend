try {
  process.loadEnvFile();
} catch {
  // .env file is optional when environment variables are passed directly
}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

const dbUrl =
  process.env.DATABASE_URL ||
  "postgresql://localhost:5432/motohippi_db";

if (!process.env.DATABASE_URL) {
  console.warn(
    "⚠️ DATABASE_URL not set in environment. Please configure DATABASE_URL in Railway Variables."
  );
}

const useSsl =
  process.env.NODE_ENV === "production" ||
  dbUrl.includes("railway") ||
  dbUrl.includes("sslmode=");

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema/index.js";
