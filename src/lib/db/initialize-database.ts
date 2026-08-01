import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { authConfig, getDefaultAdminPassword } from "@/config/auth";
import { prisma } from "./prisma";

let initPromise: Promise<void> | null = null;

function isMissingSchemaError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021";
  }
  if (error instanceof Error) {
    return (
      error.message.includes("no such table") ||
      error.message.includes("does not exist")
    );
  }
  return false;
}

function syncSchema(): void {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "pipe",
    env: process.env,
  });
}

async function createDefaultAdmin(): Promise<void> {
  const password = getDefaultAdminPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.staff.create({
    data: {
      username: authConfig.defaultUsername,
      name: authConfig.defaultName,
      passwordHash,
    },
  });
}

async function initializeDatabase(): Promise<void> {
  try {
    const staffCount = await prisma.staff.count();
    if (staffCount === 0) {
      await createDefaultAdmin();
    }
    return;
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }
  }

  syncSchema();

  const staffCount = await prisma.staff.count();
  if (staffCount === 0) {
    await createDefaultAdmin();
  }
}

/** Ensures schema exists and a default admin user is present when the staff table is empty. */
export async function ensureDatabaseInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeDatabase().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}
