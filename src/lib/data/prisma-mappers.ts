import type {
  Customer as DbCustomer,
  Transaction as DbTransaction,
} from "@/generated/prisma/client";
import type { Customer, LoyaltyData, Transaction, TransactionType } from "@/types";

export function toTransaction(row: DbTransaction): Transaction {
  return {
    id: row.id,
    customerId: row.customerId,
    type: row.type as TransactionType,
    points: row.points,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCustomerBase(row: DbCustomer): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    points: row.points,
    totalPointsEarned: 0,
    consecutivePointsEarned: 0,
    vouchersAvailable: 0,
    freeDrinkVouchersAvailable: 0,
    totalVouchersEarned: 0,
    totalFreeDrinkVouchersEarned: 0,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toLoyaltyData(
  customers: Customer[],
  transactions: Transaction[]
): LoyaltyData {
  return { customers, transactions };
}
