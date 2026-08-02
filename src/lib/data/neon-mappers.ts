import type { Customer, Transaction, TransactionType } from "@/types";

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  username: string | null;
  password_hash: string | null;
  points: number;
  total_points_earned: number;
  consecutive_points_earned: number;
  vouchers_available: number;
  free_drink_vouchers_available: number;
  total_vouchers_earned: number;
  total_free_drink_vouchers_earned: number;
  created_at: Date | string;
}

export interface TransactionRow {
  id: string;
  customer_id: string;
  type: string;
  points: number;
  reason: string;
  created_at: Date | string;
}

export function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    username: row.username ?? "",
    points: Number(row.points),
    totalPointsEarned: Number(row.total_points_earned),
    consecutivePointsEarned: Number(row.consecutive_points_earned),
    vouchersAvailable: Number(row.vouchers_available),
    freeDrinkVouchersAvailable: Number(row.free_drink_vouchers_available),
    totalVouchersEarned: Number(row.total_vouchers_earned),
    totalFreeDrinkVouchersEarned: Number(row.total_free_drink_vouchers_earned),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    customerId: row.customer_id,
    type: row.type as TransactionType,
    points: Number(row.points),
    reason: row.reason,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
