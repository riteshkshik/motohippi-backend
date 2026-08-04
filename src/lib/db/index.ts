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

const isInternalRailway = dbUrl.includes(".railway.internal");
const isPublicCloudDb =
  dbUrl.includes("rlwy.net") ||
  dbUrl.includes("sslmode=require") ||
  dbUrl.includes("neon.tech") ||
  dbUrl.includes("supabase.co") ||
  dbUrl.includes("supabase.com");

const sslConfig = isInternalRailway
  ? false
  : isPublicCloudDb
  ? { rejectUnauthorized: false }
  : false;

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: sslConfig,
});
export const db = drizzle(pool, { schema });

export * from "./schema/index.js";
