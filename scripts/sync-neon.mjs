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

function resolveTargetUrl() {
  const fromFile = readEnvValue(".env.production.local", "DATABASE_URL");
  if (fromFile?.startsWith("postgres") && fromFile !== "[SENSITIVE]") {
    return fromFile;
  }

  const explicit =
    process.env.TARGET_DATABASE_URL?.trim() ??
    process.env.DATABASE_URL_PRODUCTION?.trim();
  if (explicit?.startsWith("postgres")) {
    return explicit;
  }

  const fromProcess = process.env.DATABASE_URL?.trim();
  if (fromProcess?.startsWith("postgres") && fromProcess !== sourceUrl) {
    return fromProcess;
  }

  return undefined;
}

const targetUrl = resolveTargetUrl();

if (!sourceUrl?.startsWith("postgres")) {
  console.error("Local DATABASE_URL not found in .env.");
  process.exit(1);
}

if (!targetUrl?.startsWith("postgres")) {
  console.error(
    "Production DATABASE_URL not found. Run: npx vercel env pull .env.production.local --environment=production --yes"
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
  username TEXT UNIQUE,
  password_hash TEXT,
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

CREATE TABLE IF NOT EXISTS customer_sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  iced_price INTEGER,
  points_earned INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  voucher_to_apply TEXT NOT NULL DEFAULT 'none',
  payment_type TEXT NOT NULL DEFAULT 'cash',
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pending_orders_created_at_idx ON pending_orders(created_at DESC);

CREATE TABLE IF NOT EXISTS completed_orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  voucher_to_apply TEXT NOT NULL DEFAULT 'none',
  payment_type TEXT NOT NULL DEFAULT 'cash',
  items JSONB NOT NULL,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL,
  total INTEGER NOT NULL,
  points_earned INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS completed_orders_completed_at_idx ON completed_orders(completed_at DESC);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'cash',
  notes TEXT NOT NULL DEFAULT '',
  incurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS expenses_incurred_at_idx ON expenses(incurred_at DESC);

CREATE TABLE IF NOT EXISTS qrph_payments (
  id TEXT PRIMARY KEY,
  pending_order_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payment_intent_id TEXT NOT NULL UNIQUE,
  client_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  order_snapshot JSONB
);

CREATE INDEX IF NOT EXISTS qrph_payments_pending_order_id_idx
  ON qrph_payments(pending_order_id);
CREATE INDEX IF NOT EXISTS qrph_payments_created_at_idx
  ON qrph_payments(created_at DESC);
`;

const MIGRATIONS = [
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS username TEXT UNIQUE`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS iced_price INTEGER`,
  `ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'cash'`,
  `ALTER TABLE completed_orders ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'cash'`,
  `ALTER TABLE qrph_payments ADD COLUMN IF NOT EXISTS order_snapshot JSONB`,
];

function endpointHint(url) {
  const match = url.match(/@([^/?]+)/);
  return match?.[1] ?? "unknown";
}

async function ensureSchema(sql) {
  for (const statement of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await sql.query(statement);
  }
  for (const statement of MIGRATIONS) {
    await sql.query(statement);
  }
}

async function countRows(sql, table) {
  const rows = await sql.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
  return rows[0]?.count ?? 0;
}

async function readTable(sql, table, orderBy = "created_at ASC") {
  return sql.query(`SELECT * FROM "${table}" ORDER BY ${orderBy}`);
}

console.log("Source (local):", endpointHint(sourceUrl));
console.log("Target (online):", endpointHint(targetUrl));
console.log("\nEnsuring schema on target...");
await ensureSchema(target);

const staff = await readTable(source, "staff");
const customers = await readTable(source, "customers");
const products = await readTable(source, "products", "sort_order ASC");
const transactions = await readTable(source, "transactions");
const pendingOrders = await readTable(source, "pending_orders");
const completedOrders = await readTable(source, "completed_orders");
let expenses = [];
try {
  expenses = await readTable(source, "expenses", "incurred_at ASC");
} catch {
  expenses = [];
}
let qrphPayments = [];
try {
  qrphPayments = await readTable(source, "qrph_payments", "created_at ASC");
} catch {
  qrphPayments = [];
}

console.log(
  `Read from source: ${staff.length} staff, ${customers.length} customers, ${products.length} products, ${transactions.length} transactions, ${pendingOrders.length} pending orders, ${completedOrders.length} completed orders, ${expenses.length} expenses, ${qrphPayments.length} qrph payments`
);

console.log("Replacing target data...");
await target`DELETE FROM staff_sessions`;
await target`DELETE FROM customer_sessions`;
await target`DELETE FROM completed_orders`;
await target`DELETE FROM pending_orders`;
await target`DELETE FROM qrph_payments`;
await target`DELETE FROM expenses`;
await target`DELETE FROM transactions`;
await target`DELETE FROM customers`;
await target`DELETE FROM staff`;
await target`DELETE FROM products`;

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
      id, name, phone, email, username, password_hash, points, total_points_earned,
      consecutive_points_earned, vouchers_available,
      free_drink_vouchers_available, total_vouchers_earned,
      total_free_drink_vouchers_earned, created_at
    )
    VALUES (
      ${row.id}, ${row.name}, ${row.phone}, ${row.email}, ${row.username ?? null},
      ${row.password_hash ?? null}, ${row.points},
      ${row.total_points_earned}, ${row.consecutive_points_earned},
      ${row.vouchers_available}, ${row.free_drink_vouchers_available},
      ${row.total_vouchers_earned}, ${row.total_free_drink_vouchers_earned},
      ${row.created_at}
    )
  `;
}

for (const row of products) {
  await target`
    INSERT INTO products (
      id, name, category, price, iced_price, points_earned, description, active,
      sort_order, created_at
    )
    VALUES (
      ${row.id}, ${row.name}, ${row.category}, ${row.price}, ${row.iced_price},
      ${row.points_earned}, ${row.description}, ${row.active}, ${row.sort_order},
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

for (const row of pendingOrders) {
  await target`
    INSERT INTO pending_orders (
      id, customer_id, notes, voucher_to_apply, payment_type, items, created_at
    )
    VALUES (
      ${row.id}, ${row.customer_id}, ${row.notes}, ${row.voucher_to_apply},
      ${row.payment_type ?? "cash"}, ${row.items}, ${row.created_at}
    )
  `;
}

for (const row of completedOrders) {
  await target`
    INSERT INTO completed_orders (
      id, customer_id, transaction_id, notes, voucher_to_apply, payment_type, items, subtotal,
      discount, total, points_earned, created_at, completed_at
    )
    VALUES (
      ${row.id}, ${row.customer_id}, ${row.transaction_id}, ${row.notes},
      ${row.voucher_to_apply}, ${row.payment_type ?? "cash"}, ${row.items}, ${row.subtotal}, ${row.discount},
      ${row.total}, ${row.points_earned}, ${row.created_at}, ${row.completed_at}
    )
  `;
}

for (const row of expenses) {
  await target`
    INSERT INTO expenses (
      id, description, amount, category, payment_type, notes, incurred_at, created_at
    )
    VALUES (
      ${row.id}, ${row.description}, ${row.amount}, ${row.category},
      ${row.payment_type ?? "cash"}, ${row.notes ?? ""}, ${row.incurred_at},
      ${row.created_at}
    )
  `;
}

for (const row of qrphPayments) {
  await target`
    INSERT INTO qrph_payments (
      id, pending_order_id, amount, payment_intent_id, client_key, status,
      created_at, updated_at, paid_at, order_snapshot
    )
    VALUES (
      ${row.id}, ${row.pending_order_id}, ${row.amount}, ${row.payment_intent_id},
      ${row.client_key ?? ""}, ${row.status ?? "pending"}, ${row.created_at},
      ${row.updated_at ?? row.created_at}, ${row.paid_at ?? null},
      ${row.order_snapshot ?? null}
    )
  `;
}

console.log("\nSync complete.");
console.log(
  `Target now has: ${await countRows(target, "staff")} staff, ${await countRows(target, "customers")} customers, ${await countRows(target, "products")} products, ${await countRows(target, "transactions")} transactions, ${await countRows(target, "pending_orders")} pending orders, ${await countRows(target, "completed_orders")} completed orders, ${await countRows(target, "expenses")} expenses, ${await countRows(target, "qrph_payments")} qrph payments`
);
