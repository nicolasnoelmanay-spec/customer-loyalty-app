import bcrypt from "bcryptjs";
import { authConfig, getDefaultAdminPassword } from "@/config/auth";
import { prisma } from "./prisma";

let initPromise: Promise<void> | null = null;

export async function createDefaultAdminUser(): Promise<void> {
  const passwordHash = await bcrypt.hash(getDefaultAdminPassword(), 12);

  await prisma.staff.create({
    data: {
      username: authConfig.defaultUsername,
      name: authConfig.defaultName,
      passwordHash,
    },
  });
}

async function initializeDatabase(): Promise<void> {
  const staffCount = await prisma.staff.count();
  if (staffCount === 0) {
    await createDefaultAdminUser();
  }
}

/** Creates the default admin user when the staff directory is empty. */
export async function ensureDatabaseInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeDatabase().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}
