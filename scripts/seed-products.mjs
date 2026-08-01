import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl?.startsWith("postgres")) {
  console.error("DATABASE_URL must be a Postgres connection string.");
  process.exit(1);
}

const sql = neon(databaseUrl);

const seedProducts = [
  { id: "prod-espresso", name: "Espresso", category: "drink", price: 95, points_earned: 0, description: "Single shot", sort_order: 1 },
  { id: "prod-americano", name: "Americano", category: "drink", price: 110, points_earned: 1, description: "Espresso with hot water", sort_order: 2 },
  { id: "prod-latte", name: "Latte", category: "drink", price: 145, points_earned: 1, description: "Espresso with steamed milk", sort_order: 3 },
  { id: "prod-cappuccino", name: "Cappuccino", category: "drink", price: 145, points_earned: 1, description: "Espresso with foamed milk", sort_order: 4 },
  { id: "prod-mocha", name: "Mocha", category: "drink", price: 165, points_earned: 1, description: "Chocolate espresso drink", sort_order: 5 },
  { id: "prod-cold-brew", name: "Cold Brew", category: "drink", price: 155, points_earned: 1, description: "Slow-steeped iced coffee", sort_order: 6 },
  { id: "prod-matcha", name: "Matcha Latte", category: "drink", price: 175, points_earned: 1, description: "Ceremonial matcha with milk", sort_order: 7 },
  { id: "prod-croissant", name: "Butter Croissant", category: "snack", price: 85, points_earned: 0, description: "Flaky baked pastry", sort_order: 10 },
  { id: "prod-banana-bread", name: "Banana Bread", category: "snack", price: 95, points_earned: 0, description: "Slice of house banana bread", sort_order: 11 },
  { id: "prod-cookie", name: "Chocolate Chip Cookie", category: "snack", price: 65, points_earned: 0, description: "Fresh-baked cookie", sort_order: 12 },
  { id: "prod-grilled-cheese", name: "Grilled Cheese", category: "snack", price: 120, points_earned: 0, description: "Toasted sandwich", sort_order: 13 },
];

await sql.query(`
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`);

for (const product of seedProducts) {
  await sql`
    INSERT INTO products (
      id, name, category, price, points_earned, description, active, sort_order
    )
    VALUES (
      ${product.id}, ${product.name}, ${product.category}, ${product.price},
      ${product.points_earned}, ${product.description}, TRUE, ${product.sort_order}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

const rows = await sql`SELECT COUNT(*)::int AS count FROM products`;
console.log(`Products table ready with ${rows[0].count} item(s).`);
