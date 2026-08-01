/** Default staff account created when no staff users exist in the database. */
export const authConfig = {
  defaultUsername: "admin",
  defaultName: "Admin",
} as const;

/** Password for the auto-created admin account. Set ADMIN_PASSWORD on Vercel. */
export function getDefaultAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (password) return password;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ADMIN_PASSWORD is required in production when bootstrapping the default admin user."
    );
  }

  return "admin";
}
