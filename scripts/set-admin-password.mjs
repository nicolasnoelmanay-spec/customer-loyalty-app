import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl?.startsWith("postgres")) {
  console.error("DATABASE_URL must be a Postgres connection string.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const hash = await bcrypt.hash("12345", 10);
const rows = await sql`
  UPDATE staff
  SET password_hash = ${hash}
  WHERE username = 'admin'
  RETURNING username
`;

if (rows.length === 0) {
  console.error("Admin user not found.");
  process.exit(1);
}

console.log("Updated password for admin to 12345.");
