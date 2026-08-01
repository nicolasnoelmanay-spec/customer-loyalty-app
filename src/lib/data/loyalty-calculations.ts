import { applyStreakPointsEarned } from "@/config/loyalty";
import type { Customer, Transaction } from "@/types";

export function normalizeContact(value: string): string {
  return value.trim().toLowerCase();
}

export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function calculateTotalPointsEarned(
  customerId: string,
  transactions: Transaction[]
): number {
  return transactions
    .filter((t) => t.customerId === customerId && t.type === "earn")
    .reduce((sum, t) => sum + t.points, 0);
}

function calculateTotalVouchersEarned(
  customerId: string,
  transactions: Transaction[]
): number {
  return transactions.filter(
    (t) => t.customerId === customerId && t.type === "voucher_earn"
  ).length;
}

function calculateTotalFreeDrinkVouchersEarned(
  customerId: string,
  transactions: Transaction[]
): number {
  return transactions.filter(
    (t) => t.customerId === customerId && t.type === "free_drink_voucher_earn"
  ).length;
}

function replayStreakState(
  customerId: string,
  transactions: Transaction[]
): {
  consecutivePointsEarned: number;
  vouchersAvailable: number;
  freeDrinkVouchersAvailable: number;
} {
  const sorted = transactions
    .filter((t) => t.customerId === customerId)
    .sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  let consecutive = 0;
  let vouchers = 0;
  let freeDrinkVouchers = 0;

  for (const t of sorted) {
    if (t.type === "earn") {
      const result = applyStreakPointsEarned(consecutive, t.points);
      consecutive = result.consecutivePointsEarned;
      vouchers += result.vouchersEarned;
      freeDrinkVouchers += result.freeDrinkVouchersEarned;
    } else if (t.type === "redeem") {
      consecutive = 0;
    } else if (t.type === "voucher_redeem") {
      vouchers = Math.max(0, vouchers - 1);
    } else if (t.type === "free_drink_voucher_redeem") {
      freeDrinkVouchers = Math.max(0, freeDrinkVouchers - 1);
    }
  }

  return {
    consecutivePointsEarned: consecutive,
    vouchersAvailable: vouchers,
    freeDrinkVouchersAvailable: freeDrinkVouchers,
  };
}

export function normalizeCustomer(
  customer: Customer,
  transactions: Transaction[]
): Customer {
  const totalPointsEarned = calculateTotalPointsEarned(customer.id, transactions);
  const totalVouchersEarned = calculateTotalVouchersEarned(
    customer.id,
    transactions
  );
  const totalFreeDrinkVouchersEarned = calculateTotalFreeDrinkVouchersEarned(
    customer.id,
    transactions
  );

  const streakState = replayStreakState(customer.id, transactions);

  return {
    ...customer,
    totalPointsEarned,
    totalVouchersEarned,
    totalFreeDrinkVouchersEarned,
    consecutivePointsEarned: streakState.consecutivePointsEarned,
    vouchersAvailable: streakState.vouchersAvailable,
    freeDrinkVouchersAvailable: streakState.freeDrinkVouchersAvailable,
  };
}
