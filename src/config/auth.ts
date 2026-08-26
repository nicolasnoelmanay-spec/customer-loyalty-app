export const authConfig = {
  username: "admin",
  password: "12345",
  storageKey: "loyalty-admin-auth",
  /** Staff username with elevated permissions (completed-order edit/delete, transaction history) */
  elevatedStaffUsername: "admin2",
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

export function isElevatedStaff(username: string | null | undefined): boolean {
  return username === authConfig.elevatedStaffUsername;
}

export function canEditCompletedOrders(
  username: string | null | undefined
): boolean {
  return isElevatedStaff(username);
}

export function canDeleteCompletedOrders(
  username: string | null | undefined
): boolean {
  return isElevatedStaff(username);
}

export function canManageTransactionHistory(
  username: string | null | undefined
): boolean {
  return isElevatedStaff(username);
}
