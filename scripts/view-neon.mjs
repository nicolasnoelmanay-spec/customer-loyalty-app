import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

if (!databaseUrl.startsWith("postgres")) {
  console.error("DATABASE_URL is not a Postgres connection string.");
  process.exit(1);
}

const sql = neon(databaseUrl);

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;

console.log(
  "Neon database tables:",
  tables.map((t) => t.table_name).join(", ") || "(none)"
);
console.log();

for (const { table_name } of tables) {
  const rows = await sql.query(`SELECT * FROM "${table_name}" LIMIT 20`);
  console.log(`== ${table_name} (${rows.length} row(s) shown) ==`);
  console.log(JSON.stringify(rows, null, 2));
  console.log();
}
