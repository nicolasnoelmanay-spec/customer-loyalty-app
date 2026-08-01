import { neon, NeonQueryFunction } from "@neondatabase/serverless";

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }

  return databaseUrl;
}

let sqlClient: NeonQueryFunction<false, false> | null = null;

/** Serverless SQL client for Neon Postgres. Use in server-side code only. */
export function getSql(): NeonQueryFunction<false, false> {
  if (!sqlClient) {
    sqlClient = neon(getDatabaseUrl());
  }
  return sqlClient;
}
