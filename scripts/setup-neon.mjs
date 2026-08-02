import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { withIcedPrices } from "./product-iced-price.mjs";
import { sortProductsForCatalog } from "./product-sort.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl?.startsWith("postgres")) {
  console.error("DATABASE_URL must be a Postgres connection string.");
  process.exit(1);
}

const sql = neon(databaseUrl);

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

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_customer_id_idx
  ON password_reset_tokens(customer_id);

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
  items JSONB NOT NULL,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL,
  total INTEGER NOT NULL,
  points_earned INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS completed_orders_completed_at_idx ON completed_orders(completed_at DESC);
`;

const seedCustomer = {
  id: "cust-001",
  name: "Nicolas Noel Manay",
  phone: "+63 917 123 4567",
  email: "nicolas.manay@email.com",
  username: "nicolas",
  password: "12345",
  points: 0,
  total_points_earned: 0,
  consecutive_points_earned: 0,
  vouchers_available: 0,
  free_drink_vouchers_available: 0,
  total_vouchers_earned: 0,
  total_free_drink_vouchers_earned: 0,
  created_at: "2026-01-15T10:00:00.000Z",
};

const rawSeedProducts = [
  { id: "prod-espresso", name: "Espresso", category: "drink", price: 50, points_earned: 0, description: "", sort_order: 0 },
  { id: "prod-matcha-espresso", name: "Matcha Espresso", category: "drink", price: 155, points_earned: 1, description: "", sort_order: 1 },
  { id: "prod-americano", name: "Americano", category: "drink", price: 90, points_earned: 1, description: "", sort_order: 2 },
  { id: "prod-latte", name: "Latte", category: "drink", price: 110, points_earned: 1, description: "", sort_order: 3 },
  { id: "prod-cappuccino", name: "Cappuccino", category: "drink", price: 115, points_earned: 1, description: "", sort_order: 4 },
  { id: "prod-mocha", name: "Mocha", category: "drink", price: 120, points_earned: 1, description: "", sort_order: 5 },
  { id: "prod-caramel-macchiato", name: "Caramel Macchiato", category: "drink", price: 120, points_earned: 1, description: "", sort_order: 6 },
  { id: "prod-salted-caramel", name: "Salted Caramel", category: "drink", price: 135, points_earned: 1, description: "", sort_order: 7 },
  { id: "prod-matcha", name: "Matcha Latte", category: "drink", price: 145, points_earned: 1, description: "", sort_order: 8 },
  { id: "prod-peppermint-mocha", name: "Peppermint Mocha", category: "drink", price: 130, points_earned: 1, description: "", sort_order: 9 },
  { id: "prod-spanish-latte", name: "Spanish Latte", category: "drink", price: 135, points_earned: 1, description: "", sort_order: 10 },
  { id: "prod-white-chocolate-mocha", name: "White Chocolate Mocha", category: "drink", price: 120, points_earned: 1, description: "", sort_order: 11 },
  { id: "prod-pistachio-latte", name: "Pistachio Latte", category: "drink", price: 145, points_earned: 1, description: "", sort_order: 12 },
  { id: "prod-coffee-frappe", name: "Espresso Frappé", category: "frappe", price: 150, points_earned: 1, description: "", sort_order: 13 },
  { id: "prod-mocha-frappe", name: "Mocha Frappé", category: "frappe", price: 160, points_earned: 1, description: "", sort_order: 14 },
  { id: "prod-peppermint-mocha-frappe", name: "Peppermint Mocha Frappé", category: "frappe", price: 160, points_earned: 1, description: "", sort_order: 15 },
  { id: "prod-chocolate-frappe", name: "Chocolate Frappé", category: "frappe", price: 160, points_earned: 1, description: "", sort_order: 16 },
  { id: "prod-caramel-frappe", name: "Caramel Frappé", category: "frappe", price: 160, points_earned: 1, description: "", sort_order: 17 },
  { id: "prod-matcha-frappe", name: "Matcha Frappé", category: "frappe", price: 160, points_earned: 1, description: "", sort_order: 18 },
  { id: "prod-pistachio-frappe", name: "Pistachio Frappé", category: "frappe", price: 170, points_earned: 1, description: "", sort_order: 19 },
  { id: "prod-strawberry-frappe", name: "Strawberry Frappé", category: "frappe", price: 160, points_earned: 1, description: "", sort_order: 20 },
  { id: "prod-matcha-berry-frappe", name: "Matcha Berry Frappé", category: "frappe", price: 165, points_earned: 1, description: "", sort_order: 21 },
  { id: "prod-peanut-butter-banana-frappe", name: "Peanut Butter Banana Frappé", category: "frappe", price: 165, points_earned: 1, description: "", sort_order: 22 },
  { id: "prod-waffle", name: "Waffle", category: "snack", price: 95, points_earned: 0, description: "", sort_order: 24 },
  { id: "prod-taiwanese-chicken-bites", name: "Taiwanese Chicken Bites", category: "snack", price: 110, points_earned: 0, description: "", sort_order: 25 },
  { id: "prod-french-fries", name: "French Fries", category: "snack", price: 90, points_earned: 0, description: "", sort_order: 26 },
  { id: "prod-quarter-pounder", name: "Quarter Pounder", category: "snack", price: 159, points_earned: 0, description: "", sort_order: 27 },
  { id: "prod-quarter-pounder-double-decker", name: "Quarter Pounder - Double Decker", category: "snack", price: 299, points_earned: 0, description: "", sort_order: 28 },
];

const seedProducts = withIcedPrices(sortProductsForCatalog(rawSeedProducts));

function replayStreakState(transactions) {
  let consecutive = 0;
  let vouchers = 0;
  let freeDrinkVouchers = 0;

  for (const t of transactions) {
    if (t.type === "earn") {
      for (let i = 0; i < t.points; i++) {
        consecutive += 1;
        if (consecutive === 7) vouchers += 1;
        else if (consecutive === 14) {
          freeDrinkVouchers += 1;
          consecutive = 0;
        }
      }
    } else if (t.type === "redeem") {
      consecutive = 0;
    } else if (t.type === "voucher_redeem") {
      vouchers = Math.max(0, vouchers - 1);
    } else if (t.type === "free_drink_voucher_redeem") {
      freeDrinkVouchers = Math.max(0, freeDrinkVouchers - 1);
    }
  }

  return { consecutive, vouchers, freeDrinkVouchers };
}

function computeCustomerFields(customer, transactions) {
  const customerTxns = transactions.filter((t) => t.customer_id === customer.id);
  const totalPointsEarned = customerTxns
    .filter((t) => t.type === "earn")
    .reduce((sum, t) => sum + t.points, 0);
  const totalVouchersEarned = customerTxns.filter((t) => t.type === "voucher_earn").length;
  const totalFreeDrinkVouchersEarned = customerTxns.filter(
    (t) => t.type === "free_drink_voucher_earn"
  ).length;
  const streak = replayStreakState(customerTxns);

  return {
    ...customer,
    total_points_earned: totalPointsEarned,
    consecutive_points_earned: streak.consecutive,
    vouchers_available: streak.vouchers,
    free_drink_vouchers_available: streak.freeDrinkVouchers,
    total_vouchers_earned: totalVouchersEarned,
    total_free_drink_vouchers_earned: totalFreeDrinkVouchersEarned,
  };
}

function readSqliteData(dbPath) {
  const db = new DatabaseSync(dbPath);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((t) => t.name);

  if (!tables.includes("Customer")) return null;

  const customers = db.prepare('SELECT * FROM "Customer"').all().map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    points: row.points ?? 0,
    created_at: row.createdAt ?? new Date().toISOString(),
  }));

  const transactions = tables.includes("Transaction")
    ? db.prepare('SELECT * FROM "Transaction"').all().map((row) => ({
        id: row.id,
        customer_id: row.customerId,
        type: row.type,
        points: row.points ?? 0,
        reason: row.reason,
        created_at: row.createdAt ?? new Date().toISOString(),
      }))
    : [];

  const staff = tables.includes("Staff")
    ? db.prepare('SELECT * FROM "Staff"').all()
    : [];

  return { customers, transactions, staff };
}

async function ensureAdminStaff() {
  const existing = await sql`SELECT id FROM staff WHERE username = 'admin'`;
  if (existing.length > 0) {
    console.log("Admin staff already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash("12345", 10);
  await sql`
    INSERT INTO staff (id, username, password_hash, name)
    VALUES ('staff-admin', 'admin', ${passwordHash}, 'Administrator')
  `;
  console.log("Created admin staff (username: admin, password: 12345).");
}

async function migrateCustomers(customers, transactions) {
  for (const raw of customers) {
    const customer = computeCustomerFields(raw, transactions);
    const passwordHash = customer.password
      ? await bcrypt.hash(customer.password, 10)
      : null;
    await sql`
      INSERT INTO customers (
        id, name, phone, email, username, password_hash, points, total_points_earned,
        consecutive_points_earned, vouchers_available,
        free_drink_vouchers_available, total_vouchers_earned,
        total_free_drink_vouchers_earned, created_at
      )
      VALUES (
        ${customer.id}, ${customer.name}, ${customer.phone}, ${customer.email},
        ${customer.username ?? null}, ${passwordHash},
        ${customer.points}, ${customer.total_points_earned},
        ${customer.consecutive_points_earned}, ${customer.vouchers_available},
        ${customer.free_drink_vouchers_available}, ${customer.total_vouchers_earned},
        ${customer.total_free_drink_vouchers_earned}, ${customer.created_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const txn of transactions) {
    await sql`
      INSERT INTO transactions (id, customer_id, type, points, reason, created_at)
      VALUES (
        ${txn.id}, ${txn.customer_id}, ${txn.type}, ${txn.points},
        ${txn.reason}, ${txn.created_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

async function migrateCustomerAuthColumns() {
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS username TEXT`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT`;
}

async function backfillCustomerCredentials() {
  const defaultPasswordHash = await bcrypt.hash("12345", 10);
  const rows = await sql`
    SELECT id, email, username, password_hash
    FROM customers
    WHERE username IS NULL OR password_hash IS NULL
  `;

  for (const row of rows) {
    let username = row.username;
    if (!username) {
      const base =
        row.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") ||
        "member";
      username = base;
      let suffix = 1;
      while (true) {
        const existing = await sql`
          SELECT id FROM customers
          WHERE LOWER(username) = ${username.toLowerCase()} AND id <> ${row.id}
          LIMIT 1
        `;
        if (existing.length === 0) break;
        username = `${base}${suffix}`;
        suffix += 1;
      }
    }

    await sql`
      UPDATE customers
      SET username = ${username},
          password_hash = ${row.password_hash ?? defaultPasswordHash}
      WHERE id = ${row.id}
    `;
  }

  if (rows.length > 0) {
    console.log(
      `Backfilled credentials for ${rows.length} existing customer(s). Default password: 12345`
    );
  }
}

async function seedProductCatalog() {
  for (const product of seedProducts) {
    await sql`
      INSERT INTO products (
        id, name, category, price, iced_price, points_earned, description, active, sort_order
      )
      VALUES (
        ${product.id}, ${product.name}, ${product.category}, ${product.price},
        ${product.iced_price}, ${product.points_earned}, ${product.description}, TRUE, ${product.sort_order}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        price = EXCLUDED.price,
        iced_price = EXCLUDED.iced_price,
        points_earned = EXCLUDED.points_earned,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order
    `;
  }
}

console.log("Creating Neon schema...");
for (const statement of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
  await sql.query(statement);
}

await sql.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS iced_price INTEGER`);

await migrateCustomerAuthColumns();
await backfillCustomerCredentials();

await ensureAdminStaff();
await seedProductCatalog();
console.log(`Seeded ${seedProducts.length} product(s).`);

const existingCustomers = await sql`SELECT COUNT(*)::int AS count FROM customers`;
if (existingCustomers[0].count > 0) {
  console.log(`Customers table already has ${existingCustomers[0].count} row(s). Skipping data migration.`);
} else {
  const sqlitePath = resolve("prisma/dev.db");
  let imported = false;

  if (existsSync(sqlitePath)) {
    console.log(`Migrating from SQLite: ${sqlitePath}`);
    const sqliteData = readSqliteData(sqlitePath);
    if (sqliteData && sqliteData.customers.length > 0) {
      await migrateCustomers(sqliteData.customers, sqliteData.transactions);
      console.log(
        `Migrated ${sqliteData.customers.length} customer(s) and ${sqliteData.transactions.length} transaction(s) from SQLite.`
      );
      imported = true;
    }
  }

  if (!imported) {
    console.log("Seeding default customer...");
    await migrateCustomers([seedCustomer], []);
    console.log("Seeded 1 default customer.");
  }
}

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;

console.log("\nNeon database ready.");
console.log("Tables:", tables.map((t) => t.table_name).join(", "));

for (const { table_name } of tables) {
  if (["staff_sessions"].includes(table_name)) continue;
  const rows = await sql.query(`SELECT * FROM "${table_name}" LIMIT 20`);
  console.log(`\n== ${table_name} (${rows.length} row(s)) ==`);
  console.log(JSON.stringify(rows, null, 2));
}
