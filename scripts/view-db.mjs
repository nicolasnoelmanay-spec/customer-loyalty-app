import { DatabaseSync } from "node:sqlite";

const dbPath = process.argv[2] ?? "prisma/dev.db";
const db = new DatabaseSync(dbPath);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();

console.log(`Database file: ${dbPath}`);
console.log(`Tables: ${tables.map((t) => t.name).join(", ") || "(none)"}\n`);

for (const { name } of tables) {
  if (name.startsWith("sqlite_")) continue;

  const rows = db.prepare(`SELECT * FROM "${name}" LIMIT 20`).all();
  console.log(`== ${name} (${rows.length} row(s) shown) ==`);
  console.log(JSON.stringify(rows, null, 2));
  console.log();
}
