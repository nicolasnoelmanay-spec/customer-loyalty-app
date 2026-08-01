import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function readEnvValue(filePath, key) {
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) return undefined;

  for (const line of readFileSync(absolutePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!trimmed.startsWith(`${key}=`)) continue;

    let value = trimmed.slice(key.length + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }

  return undefined;
}

const sourceUrl =
  process.env.SOURCE_DATABASE_URL?.trim() ??
  readEnvValue(".env", "DATABASE_URL");
const targetUrl =
  process.env.TARGET_DATABASE_URL?.trim() ??
  readEnvValue(".env.production.local", "DATABASE_URL") ??
  process.env.DATABASE_URL_PRODUCTION?.trim();

if (!sourceUrl?.startsWith("postgres")) {
  console.error("Local DATABASE_URL not found in .env.");
  process.exit(1);
}

if (!targetUrl?.startsWith("postgres")) {
  console.error(
    "Production DATABASE_URL not found. Run: npx vercel env pull .env.production.local --environment=production"
  );
  process.exit(1);
}

if (sourceUrl === targetUrl) {
  console.error("Source and target DATABASE_URL must be different.");
  process.exit(1);
}

const source = neon(sourceUrl);
const target = neon(targetUrl);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  total_points_earned INTEGER NOT NULL DEFAULT 0,
  consecutive_points_earned INTEGER NOT NULL DEFAULT 0,
  vouchers_available INTEGER NOT NULL DEFAULT 0,
  free_drink_vouchers_available INTEGER NOT NULL DEFAULT 0,
  total_vouchers_earned INTEGER NOT NULL DEFAULT 0,
  total_free_drink_vouchers_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_customer_id_idx ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at DESC);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_sessions (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function endpointHint(url) {
  const match = url.match(/@([^/?]+)/);
  return match?.[1] ?? "unknown";
}

async function ensureSchema(sql) {
  for (const statement of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await sql.query(statement);
  }
}

async function countRows(sql, table) {
  const rows = await sql.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
  return rows[0]?.count ?? 0;
}

console.log("Source (local):", endpointHint(sourceUrl));
console.log("Target (online):", endpointHint(targetUrl));
console.log("\nEnsuring schema on target...");
await ensureSchema(target);

const staff = await source`SELECT * FROM staff ORDER BY created_at ASC`;
const customers = await source`SELECT * FROM customers ORDER BY created_at ASC`;
const transactions =
  await source`SELECT * FROM transactions ORDER BY created_at ASC`;

console.log(
  `Read from source: ${staff.length} staff, ${customers.length} customers, ${transactions.length} transactions`
);

console.log("Replacing target data...");
await target`DELETE FROM staff_sessions`;
await target`DELETE FROM transactions`;
await target`DELETE FROM customers`;
await target`DELETE FROM staff`;

for (const row of staff) {
  await target`
    INSERT INTO staff (id, username, password_hash, name, created_at)
    VALUES (
      ${row.id}, ${row.username}, ${row.password_hash}, ${row.name}, ${row.created_at}
    )
  `;
}

for (const row of customers) {
  await target`
    INSERT INTO customers (
      id, name, phone, email, points, total_points_earned,
      consecutive_points_earned, vouchers_available,
      free_drink_vouchers_available, total_vouchers_earned,
      total_free_drink_vouchers_earned, created_at
    )
    VALUES (
      ${row.id}, ${row.name}, ${row.phone}, ${row.email}, ${row.points},
      ${row.total_points_earned}, ${row.consecutive_points_earned},
      ${row.vouchers_available}, ${row.free_drink_vouchers_available},
      ${row.total_vouchers_earned}, ${row.total_free_drink_vouchers_earned},
      ${row.created_at}
    )
  `;
}

for (const row of transactions) {
  await target`
    INSERT INTO transactions (id, customer_id, type, points, reason, created_at)
    VALUES (
      ${row.id}, ${row.customer_id}, ${row.type}, ${row.points},
      ${row.reason}, ${row.created_at}
    )
  `;
}

const targetStaff = await countRows(target, "staff");
const targetCustomers = await countRows(target, "customers");
const targetTransactions = await countRows(target, "transactions");

console.log("\nSync complete.");
console.log(
  `Target now has: ${targetStaff} staff, ${targetCustomers} customers, ${targetTransactions} transactions`
);
