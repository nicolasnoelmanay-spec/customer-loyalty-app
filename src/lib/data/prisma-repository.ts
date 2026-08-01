import {
  loyaltyConfig,
  calculatePointsFromDrinks,
  applyStreakPointsEarned,
  formatDrinkCount,
} from "@/config/loyalty";
import { prisma } from "@/lib/db/prisma";
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
import {
  generateId,
  normalizeContact,
  normalizeCustomer,
} from "./loyalty-calculations";
import { toCustomerBase, toLoyaltyData, toTransaction } from "./prisma-mappers";

export class PrismaLoyaltyRepository {
  private async loadNormalizedData(): Promise<LoyaltyData> {
    const [customerRows, transactionRows] = await Promise.all([
      prisma.customer.findMany(),
      prisma.transaction.findMany(),
    ]);

    const transactions = transactionRows.map(toTransaction);
    const customers = customerRows
      .map((row) => normalizeCustomer(toCustomerBase(row), transactions))
      .sort((a, b) => a.name.localeCompare(b.name));

    return toLoyaltyData(customers, transactions);
  }

  async getData(): Promise<LoyaltyData> {
    return this.loadNormalizedData();
  }

  async getCustomers(): Promise<Customer[]> {
    const data = await this.loadNormalizedData();
    return data.customers;
  }

  async getCustomerById(id: string): Promise<Customer | undefined> {
    const customers = await this.getCustomers();
    return customers.find((c) => c.id === id);
  }

  async findCustomerByContact(phoneOrEmail: string): Promise<Customer | undefined> {
    const query = normalizeContact(phoneOrEmail);
    const trimmed = phoneOrEmail.trim();
    const customers = await this.getCustomers();
    return customers.find(
      (c) =>
        normalizeContact(c.phone) === query ||
        normalizeContact(c.email) === query ||
        c.phone.includes(trimmed) ||
        c.email.toLowerCase() === query
    );
  }

  async getTransactions(): Promise<Transaction[]> {
    const rows = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toTransaction);
  }

  async getTransactionsForCustomer(customerId: string): Promise<Transaction[]> {
    const rows = await prisma.transaction.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toTransaction);
  }

  async addCustomer(input: CreateCustomerInput): Promise<Customer> {
    const id = generateId("cust");
    const now = new Date();

    await prisma.customer.create({
      data: {
        id,
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: input.email.trim().toLowerCase(),
        points: 0,
        createdAt: now,
      },
    });

    return {
      id,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      points: 0,
      totalPointsEarned: 0,
      consecutivePointsEarned: 0,
      vouchersAvailable: 0,
      freeDrinkVouchersAvailable: 0,
      totalVouchersEarned: 0,
      totalFreeDrinkVouchersEarned: 0,
      createdAt: now.toISOString(),
    };
  }

  async updateCustomer(input: UpdateCustomerInput): Promise<Customer> {
    const existing = await this.getCustomerById(input.customerId);
    if (!existing) throw new Error("Customer not found");
    if (input.points < 0 || !Number.isInteger(input.points)) {
      throw new Error("Points must be a non-negative whole number.");
    }

    const pointsDelta = input.points - existing.points;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: input.customerId },
        data: {
          name: input.name.trim(),
          phone: input.phone.trim(),
          email: input.email.trim().toLowerCase(),
          points: input.points,
        },
      });

      if (pointsDelta !== 0) {
        await tx.transaction.create({
          data: {
            id: generateId("txn"),
            customerId: input.customerId,
            type: "adjust",
            points: pointsDelta,
            reason: `Manual adjustment (${existing.points} → ${input.points})`,
            createdAt: now,
          },
        });
      }
    });

    const updated = await this.getCustomerById(input.customerId);
    if (!updated) throw new Error("Customer not found after update");
    return updated;
  }

  async logPurchase(input: LogPurchaseInput): Promise<Transaction> {
    const customer = await this.getCustomerById(input.customerId);
    if (!customer) throw new Error("Customer not found");

    const points = calculatePointsFromDrinks(input.drinkCount);
    const notes = input.notes?.trim();
    const drinkSummary = formatDrinkCount(input.drinkCount);
    const reason = notes ? `${drinkSummary} — ${notes}` : drinkSummary;
    const now = new Date();

    const transaction: Transaction = {
      id: generateId("txn"),
      customerId: input.customerId,
      type: "earn",
      points,
      reason,
      createdAt: now.toISOString(),
    };

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
            createdAt: now.toISOString(),
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
        createdAt: now.toISOString(),
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
        createdAt: now.toISOString(),
      })
    );

    const allTransactions = [
      transaction,
      ...voucherTransactions,
      ...freeDrinkVoucherTransactions,
      ...(streakResetTransaction ? [streakResetTransaction] : []),
    ];

    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: input.customerId },
        data: { points: newBalance },
      });

      await tx.transaction.createMany({
        data: allTransactions.map((t) => ({
          id: t.id,
          customerId: t.customerId,
          type: t.type,
          points: t.points,
          reason: t.reason,
          createdAt: now,
        })),
      });
    });

    return transaction;
  }

  async redeemPoints(input: RedeemPointsInput): Promise<Transaction> {
    const customer = await this.getCustomerById(input.customerId);
    if (!customer) throw new Error("Customer not found");
    if (input.points <= 0) throw new Error("Points must be greater than zero");
    if (customer.points < input.points) throw new Error("Insufficient points");

    const reason = input.reason?.trim() || `Redeemed ${input.points} points`;
    const now = new Date();

    const transaction: Transaction = {
      id: generateId("txn"),
      customerId: input.customerId,
      type: "redeem",
      points: input.points,
      reason,
      createdAt: now.toISOString(),
    };

    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: input.customerId },
        data: { points: customer.points - input.points },
      });

      await tx.transaction.create({
        data: {
          id: transaction.id,
          customerId: transaction.customerId,
          type: transaction.type,
          points: transaction.points,
          reason: transaction.reason,
          createdAt: now,
        },
      });
    });

    return transaction;
  }

  async redeemVoucher(input: RedeemVoucherInput): Promise<Transaction> {
    const customer = await this.getCustomerById(input.customerId);
    if (!customer) throw new Error("Customer not found");

    const count = input.count ?? 1;
    if (count <= 0 || !Number.isInteger(count)) {
      throw new Error("Voucher count must be a positive whole number.");
    }
    if (customer.vouchersAvailable < count) {
      throw new Error(`Only ${customer.vouchersAvailable} voucher(s) available.`);
    }

    const now = new Date();
    const voucherTransactions: Transaction[] = Array.from({ length: count }, () => ({
      id: generateId("txn"),
      customerId: input.customerId,
      type: "voucher_redeem" as const,
      points: 0,
      reason: loyaltyConfig.voucher.redeemReason,
      createdAt: now.toISOString(),
    }));

    if (count > 1 && voucherTransactions[0]) {
      voucherTransactions[0] = {
        ...voucherTransactions[0],
        reason:
          input.reason?.trim() ||
          `Redeemed ${count} × ${loyaltyConfig.voucher.label}`,
      };
    }

    await prisma.transaction.createMany({
      data: voucherTransactions.map((t) => ({
        id: t.id,
        customerId: t.customerId,
        type: t.type,
        points: t.points,
        reason: t.reason,
        createdAt: now,
      })),
    });

    return voucherTransactions[0]!;
  }

  async redeemFreeDrinkVoucher(
    input: RedeemFreeDrinkVoucherInput
  ): Promise<Transaction> {
    const customer = await this.getCustomerById(input.customerId);
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

    const now = new Date();
    const freeDrinkTransactions: Transaction[] = Array.from(
      { length: count },
      () => ({
        id: generateId("txn"),
        customerId: input.customerId,
        type: "free_drink_voucher_redeem" as const,
        points: 0,
        reason: loyaltyConfig.freeDrinkVoucher.redeemReason,
        createdAt: now.toISOString(),
      })
    );

    if (count > 1 && freeDrinkTransactions[0]) {
      freeDrinkTransactions[0] = {
        ...freeDrinkTransactions[0],
        reason:
          input.reason?.trim() ||
          `Redeemed ${count} × ${loyaltyConfig.freeDrinkVoucher.label}`,
      };
    }

    await prisma.transaction.createMany({
      data: freeDrinkTransactions.map((t) => ({
        id: t.id,
        customerId: t.customerId,
        type: t.type,
        points: t.points,
        reason: t.reason,
        createdAt: now,
      })),
    });

    return freeDrinkTransactions[0]!;
  }

  async clearTransactionHistory(): Promise<void> {
    await prisma.transaction.deleteMany();
  }
}

let repository: PrismaLoyaltyRepository | null = null;

export function getPrismaLoyaltyRepository(): PrismaLoyaltyRepository {
  if (!repository) {
    repository = new PrismaLoyaltyRepository();
  }
  return repository;
}
