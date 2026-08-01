/**
 * Staff authentication configuration.
 * Default admin is created automatically when no staff users exist (see initialize-database.ts).
 */
export const authConfig = {
  defaultUsername: "admin",
  defaultName: "Admin",
} as const;

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (password) return password;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ADMIN_PASSWORD environment variable is required in production."
    );
  }

  return "admin";
}

export function getDefaultAdminPassword(): string {
  return getAdminPassword();
}
