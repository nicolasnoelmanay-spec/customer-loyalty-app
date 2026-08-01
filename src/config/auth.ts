export const authConfig = {
  username: "admin",
  password: "admib",
  storageKey: "loyalty-admin-auth",
} as const;

export function validateStaffCredentials(
  username: string,
  password: string
): boolean {
  return (
    username.trim() === authConfig.username &&
    password === authConfig.password
  );
}
