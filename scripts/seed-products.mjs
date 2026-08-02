import { neon } from "@neondatabase/serverless";
import { withIcedPrices } from "./product-iced-price.mjs";
import { sortProductsForCatalog } from "./product-sort.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl?.startsWith("postgres")) {
  console.error("DATABASE_URL must be a Postgres connection string.");
  process.exit(1);
}

const sql = neon(databaseUrl);

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

await sql.query(`
ALTER TABLE products
ADD COLUMN IF NOT EXISTS iced_price INTEGER;
`);

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

await sql`DELETE FROM products WHERE id IN ('prod-cold-brew', 'prod-croissant', 'prod-banana-bread', 'prod-cookie', 'prod-grilled-cheese', 'prod-regular-quarter-pounder')`;

const rows = await sql`SELECT COUNT(*)::int AS count FROM products`;
console.log(`Products table ready with ${rows[0].count} item(s).`);
