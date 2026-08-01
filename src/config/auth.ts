/**
 * Staff authentication configuration.
 * Default admin is created automatically when no staff users exist (see initialize-database.ts).
 */
export const authConfig = {
  defaultUsername: "admin",
  defaultName: "Admin",
  defaultPassword: "admin",
} as const;

export function getDefaultAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || authConfig.defaultPassword;
}
