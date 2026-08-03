import {
  loyaltyConfig,
  calculatePointsFromDrinks,
  applyStreakPointsEarned,
  formatDrinkCount,
} from "@/config/loyalty";
import type {
  CreateCustomerInput,
  Customer,
  LogPurchaseInput,
  LoyaltyData,
  RedeemFreeDrinkVoucherInput,
  RedeemPointsInput,
  RedeemVoucherInput,
  Transaction,
  UpdateCustomerInput,
} from "@/types";
import type { LoyaltyRepository } from "./types";
import { seedData } from "./seed-data";
import {
  generateId,
  normalizeContact,
  normalizeCustomer,
} from "./loyalty-calculations";
import { isNonMemberCustomer } from "./non-member";

function normalizeData(data: LoyaltyData): LoyaltyData {
  return {
    ...data,
    customers: data.customers.map((c) => normalizeCustomer(c, data.transactions)),
  };
}

export class LocalStorageLoyaltyRepository implements LoyaltyRepository {
  private data: LoyaltyData;

  constructor() {
    this.data = this.load();
  }

  private load(): LoyaltyData {
    if (typeof window === "undefined") {
      return structuredClone(seedData);
    }

    try {
      const stored = localStorage.getItem(loyaltyConfig.storageKey);
      if (stored) {
        return normalizeData(JSON.parse(stored) as LoyaltyData);
      }
    } catch {
      // Fall through to seed data
    }

    const initial = structuredClone(seedData);
    this.persist(initial);
    return initial;
  }

  private persist(data: LoyaltyData): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(loyaltyConfig.storageKey, JSON.stringify(data));
    }
    this.data = data;
  }

  getData(): LoyaltyData {
    return this.data;
  }

  getCustomers(): Customer[] {
    return [...this.data.customers].sort((a, b) => a.name.localeCompare(b.name));
  }

  getCustomerById(id: string): Customer | undefined {
    return this.data.customers.find((c) => c.id === id);
  }

  findCustomerByContact(phoneOrEmail: string): Customer | undefined {
    const query = normalizeContact(phoneOrEmail);
    return this.data.customers.find(
      (c) =>
        normalizeContact(c.phone) === query ||
        normalizeContact(c.email) === query ||
        c.phone.includes(phoneOrEmail.trim()) ||
        c.email.toLowerCase() === query
    );
  }

  getTransactions(): Transaction[] {
    return [...this.data.transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getTransactionsForCustomer(customerId: string): Transaction[] {
    return this.getTransactions().filter((t) => t.customerId === customerId);
  }

  addCustomer(input: CreateCustomerInput): Customer {
    const customer: Customer = {
      id: generateId("cust"),
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      username: input.username.trim().toLowerCase(),
      points: 0,
      totalPointsEarned: 0,
      consecutivePointsEarned: 0,
      vouchersAvailable: 0,
      freeDrinkVouchersAvailable: 0,
      totalVouchersEarned: 0,
      totalFreeDrinkVouchersEarned: 0,
      createdAt: new Date().toISOString(),
    };

    const next: LoyaltyData = {
      ...this.data,
      customers: [...this.data.customers, customer],
    };
    this.persist(next);
    return customer;
  }

  updateCustomer(input: UpdateCustomerInput): Customer {
    const existing = this.getCustomerById(input.customerId);
    if (!existing) throw new Error("Customer not found");
    if (input.points < 0 || !Number.isInteger(input.points)) {
      throw new Error("Points must be a non-negative whole number.");
    }

    const pointsDelta = input.points - existing.points;

    const updated: Customer = {
      ...existing,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      points: input.points,
    };

    const adjustmentTransaction: Transaction | null =
      pointsDelta !== 0
        ? {
            id: generateId("txn"),
            customerId: input.customerId,
            type: "adjust",
            points: pointsDelta,
            reason: `Manual adjustment (${existing.points} → ${input.points})`,
            createdAt: new Date().toISOString(),
          }
        : null;

    this.persist({
      ...this.data,
      customers: this.data.customers.map((c) =>
        c.id === input.customerId ? updated : c
      ),
      transactions: adjustmentTransaction
        ? [adjustmentTransaction, ...this.data.transactions]
        : this.data.transactions,
    });

    return updated;
  }

  logPurchase(input: LogPurchaseInput): Transaction {
    const customer = this.getCustomerById(input.customerId);
    if (!customer) throw new Error("Customer not found");

    const drinkCount = input.drinkCount;
    if (typeof drinkCount !== "number" || !Number.isInteger(drinkCount) || drinkCount <= 0) {
      throw new Error("Enter a valid number of coffee drinks.");
    }

    const points = isNonMemberCustomer(input.customerId)
      ? 0
      : calculatePointsFromDrinks(drinkCount);
    const notes = input.notes?.trim();
    const drinkSummary = formatDrinkCount(drinkCount);
    let reason = notes ? `${drinkSummary} — ${notes}` : drinkSummary;
    if (isNonMemberCustomer(input.customerId)) {
      reason = `${reason} — Non-member (no loyalty)`;
    }

    const transaction: Transaction = {
      id: generateId("txn"),
      customerId: input.customerId,
      type: "earn",
      points,
      reason,
      createdAt: new Date().toISOString(),
    };

    const newTotalPointsEarned = customer.totalPointsEarned + points;
    const {
      consecutivePointsEarned,
      vouchersEarned,
      freeDrinkVouchersEarned,
      pointsReset,
      cyclesCompleted,
    } = applyStreakPointsEarned(customer.consecutivePointsEarned, points);

    const newBalance = Math.max(0, customer.points + points - pointsReset);

    const streakResetTransaction: Transaction | null =
      pointsReset > 0
        ? {
            id: generateId("txn"),
            customerId: input.customerId,
            type: "redeem",
            points: customer.points + points - newBalance,
            reason:
              cyclesCompleted === 1
                ? loyaltyConfig.streakResetReason
                : `${loyaltyConfig.streakResetReason} (${cyclesCompleted} cycles)`,
            createdAt: new Date().toISOString(),
          }
        : null;

    const voucherTransactions: Transaction[] = Array.from(
      { length: vouchersEarned },
      () => ({
        id: generateId("txn"),
        customerId: input.customerId,
        type: "voucher_earn" as const,
        points: 0,
        reason: loyaltyConfig.voucher.earnReason,
        createdAt: new Date().toISOString(),
      })
    );

    const freeDrinkVoucherTransactions: Transaction[] = Array.from(
      { length: freeDrinkVouchersEarned },
      () => ({
        id: generateId("txn"),
        customerId: input.customerId,
        type: "free_drink_voucher_earn" as const,
        points: 0,
        reason: loyaltyConfig.freeDrinkVoucher.earnReason,
        createdAt: new Date().toISOString(),
      })
    );

    const updatedCustomers = this.data.customers.map((c) =>
      c.id === input.customerId
        ? {
            ...c,
            points: newBalance,
            totalPointsEarned: newTotalPointsEarned,
            totalVouchersEarned: customer.totalVouchersEarned + vouchersEarned,
            totalFreeDrinkVouchersEarned:
              customer.totalFreeDrinkVouchersEarned + freeDrinkVouchersEarned,
            consecutivePointsEarned,
            vouchersAvailable: c.vouchersAvailable + vouchersEarned,
            freeDrinkVouchersAvailable:
              c.freeDrinkVouchersAvailable + freeDrinkVouchersEarned,
          }
        : c
    );

    this.persist({
      customers: updatedCustomers,
      transactions: [
        transaction,
        ...voucherTransactions,
        ...freeDrinkVoucherTransactions,
        ...(streakResetTransaction ? [streakResetTransaction] : []),
        ...this.data.transactions,
      ],
    });

    return transaction;
  }

  redeemPoints(input: RedeemPointsInput): Transaction {
    const customer = this.getCustomerById(input.customerId);
    if (!customer) throw new Error("Customer not found");
    if (input.points <= 0) throw new Error("Points must be greater than zero");
    if (customer.points < input.points) throw new Error("Insufficient points");

    const reason =
      input.reason?.trim() || `Redeemed ${input.points} points`;

    const transaction: Transaction = {
      id: generateId("txn"),
      customerId: input.customerId,
      type: "redeem",
      points: input.points,
      reason,
      createdAt: new Date().toISOString(),
    };

    const updatedCustomers = this.data.customers.map((c) =>
      c.id === input.customerId
        ? { ...c, points: c.points - input.points, consecutivePointsEarned: 0 }
        : c
    );

    this.persist({
      customers: updatedCustomers,
      transactions: [transaction, ...this.data.transactions],
    });

    return transaction;
  }

  redeemVoucher(input: RedeemVoucherInput): Transaction {
    const customer = this.getCustomerById(input.customerId);
    if (!customer) throw new Error("Customer not found");

    const count = input.count ?? 1;
    if (count <= 0 || !Number.isInteger(count)) {
      throw new Error("Voucher count must be a positive whole number.");
    }
    if (customer.vouchersAvailable < count) {
      throw new Error(`Only ${customer.vouchersAvailable} voucher(s) available.`);
    }

    const voucherTransactions: Transaction[] = Array.from({ length: count }, () => ({
      id: generateId("txn"),
      customerId: input.customerId,
      type: "voucher_redeem" as const,
      points: 0,
      reason:
        input.reason?.trim() ||
        (count === 1
          ? loyaltyConfig.voucher.redeemReason
          : loyaltyConfig.voucher.redeemReason),
      createdAt: new Date().toISOString(),
    }));

    if (count > 1 && voucherTransactions[0]) {
      voucherTransactions[0] = {
        ...voucherTransactions[0],
        reason:
          input.reason?.trim() ||
          `Redeemed ${count} × ${loyaltyConfig.voucher.label}`,
      };
    }

    const updatedCustomers = this.data.customers.map((c) =>
      c.id === input.customerId
        ? {
            ...c,
            vouchersAvailable: c.vouchersAvailable - count,
          }
        : c
    );

    this.persist({
      customers: updatedCustomers,
      transactions: [...voucherTransactions, ...this.data.transactions],
    });

    return voucherTransactions[0]!;
  }

  redeemFreeDrinkVoucher(input: RedeemFreeDrinkVoucherInput): Transaction {
    const customer = this.getCustomerById(input.customerId);
    if (!customer) throw new Error("Customer not found");

    const count = input.count ?? 1;
    if (count <= 0 || !Number.isInteger(count)) {
      throw new Error("Voucher count must be a positive whole number.");
    }
    if (customer.freeDrinkVouchersAvailable < count) {
      throw new Error(
        `Only ${customer.freeDrinkVouchersAvailable} free drink voucher(s) available.`
      );
    }

    const freeDrinkTransactions: Transaction[] = Array.from({ length: count }, () => ({
      id: generateId("txn"),
      customerId: input.customerId,
      type: "free_drink_voucher_redeem" as const,
      points: 0,
      reason: loyaltyConfig.freeDrinkVoucher.redeemReason,
      createdAt: new Date().toISOString(),
    }));

    if (count > 1 && freeDrinkTransactions[0]) {
      freeDrinkTransactions[0] = {
        ...freeDrinkTransactions[0],
        reason:
          input.reason?.trim() ||
          `Redeemed ${count} × ${loyaltyConfig.freeDrinkVoucher.label}`,
      };
    }

    const updatedCustomers = this.data.customers.map((c) =>
      c.id === input.customerId
        ? {
            ...c,
            freeDrinkVouchersAvailable: c.freeDrinkVouchersAvailable - count,
          }
        : c
    );

    this.persist({
      customers: updatedCustomers,
      transactions: [...freeDrinkTransactions, ...this.data.transactions],
    });

    return freeDrinkTransactions[0]!;
  }

  clearTransactionHistory(): void {
    this.persist({
      ...this.data,
      transactions: [],
    });
  }
}
