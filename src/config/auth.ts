export const authConfig = {
  username: "admin",
  password: "12345",
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
