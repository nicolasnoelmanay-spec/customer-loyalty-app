import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { authConfig } from "../src/config/auth";

const connectionString = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.staff.upsert({
    where: { username: authConfig.defaultUsername },
    update: { name: authConfig.defaultName },
    create: {
      username: authConfig.defaultUsername,
      name: authConfig.defaultName,
    },
  });

  await prisma.customer.upsert({
    where: { id: "cust-001" },
    update: {},
    create: {
      id: "cust-001",
      name: "Nicolas Noel Manay",
      phone: "+63 917 123 4567",
      email: "nicolas.manay@email.com",
      points: 0,
      createdAt: new Date("2026-01-15T10:00:00.000Z"),
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
