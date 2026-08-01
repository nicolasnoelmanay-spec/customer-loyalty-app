/**
 * Admin authentication configuration.
 * Swap for server-side auth or environment variables in production.
 */
export const authConfig = {
  username: "admin",
  password: "admin",
  storageKey: "loyalty-admin-auth",
} as const;

export function validateAdminCredentials(
  username: string,
  password: string
): boolean {
  return (
    username.trim() === authConfig.username &&
    password === authConfig.password
  );
}
