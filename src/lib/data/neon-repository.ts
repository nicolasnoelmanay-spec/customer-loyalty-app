import {
  loyaltyConfig,
  calculatePointsFromDrinks,
  applyStreakPointsEarned,
  formatDrinkCount,
} from "@/config/loyalty";
import { getSql } from "@/lib/db";
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
import { generateId, normalizeContact } from "./loyalty-calculations";
import {
  mapCustomer,
  mapTransaction,
  type CustomerRow,
  type TransactionRow,
} from "./neon-mappers";

async function fetchCustomers(): Promise<Customer[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM customers
    ORDER BY name ASC
  `;
  return (rows as CustomerRow[]).map(mapCustomer);
}

async function fetchTransactions(): Promise<Transaction[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM transactions
    ORDER BY created_at DESC
  `;
  return (rows as TransactionRow[]).map(mapTransaction);
}

async function getCustomerRow(id: string): Promise<CustomerRow | null> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM customers WHERE id = ${id}`;
  return rows.length > 0 ? (rows[0] as CustomerRow) : null;
}

export async function getLoyaltyData(): Promise<LoyaltyData> {
  const [customers, transactions] = await Promise.all([
    fetchCustomers(),
    fetchTransactions(),
  ]);
  return { customers, transactions };
}

export async function findCustomerByContact(
  phoneOrEmail: string
): Promise<Customer | null> {
  const query = normalizeContact(phoneOrEmail);
  const trimmed = phoneOrEmail.trim();
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM customers
    WHERE LOWER(TRIM(email)) = ${query}
       OR LOWER(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''))
          LIKE ${"%" + query.replace(/\D/g, "") + "%"}
       OR phone LIKE ${"%" + trimmed + "%"}
    LIMIT 1
  `;
  return rows.length > 0 ? mapCustomer(rows[0] as CustomerRow) : null;
}

export async function addCustomer(
  input: CreateCustomerInput
): Promise<Customer> {
  const id = generateId("cust");
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const sql = getSql();

  const rows = await sql`
    INSERT INTO customers (
      id, name, phone, email, points, total_points_earned,
      consecutive_points_earned, vouchers_available,
      free_drink_vouchers_available, total_vouchers_earned,
      total_free_drink_vouchers_earned
    )
    VALUES (
      ${id}, ${name}, ${phone}, ${email}, 0, 0, 0, 0, 0, 0, 0
    )
    RETURNING *
  `;

  return mapCustomer(rows[0] as CustomerRow);
}

export async function updateCustomer(
  input: UpdateCustomerInput
): Promise<Customer> {
  const existing = await getCustomerRow(input.customerId);
  if (!existing) throw new Error("Customer not found");
  if (input.points < 0 || !Number.isInteger(input.points)) {
    throw new Error("Points must be a non-negative whole number.");
  }

  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const pointsDelta = input.points - Number(existing.points);
  const sql = getSql();

  const queries = [
    sql`
      UPDATE customers
      SET name = ${name}, phone = ${phone}, email = ${email}, points = ${input.points}
      WHERE id = ${input.customerId}
      RETURNING *
    `,
  ];

  if (pointsDelta !== 0) {
    queries.push(
      sql`
        INSERT INTO transactions (id, customer_id, type, points, reason)
        VALUES (
          ${generateId("txn")},
          ${input.customerId},
          'adjust',
          ${pointsDelta},
          ${`Manual adjustment (${existing.points} → ${input.points})`}
        )
      `
    );
  }

  const results = await sql.transaction(queries);
  return mapCustomer((results[0] as CustomerRow[])[0] as CustomerRow);
}

export async function logPurchase(
  input: LogPurchaseInput
): Promise<Transaction> {
  const customer = await getCustomerRow(input.customerId);
  if (!customer) throw new Error("Customer not found");

  const points = calculatePointsFromDrinks(input.drinkCount);
  const notes = input.notes?.trim();
  const drinkSummary = formatDrinkCount(input.drinkCount);
  const reason = notes ? `${drinkSummary} — ${notes}` : drinkSummary;

  const transactionId = generateId("txn");
  const newTotalPointsEarned = Number(customer.total_points_earned) + points;
  const {
    consecutivePointsEarned,
    vouchersEarned,
    freeDrinkVouchersEarned,
    pointsReset,
    cyclesCompleted,
  } = applyStreakPointsEarned(
    Number(customer.consecutive_points_earned),
    points
  );

  const newBalance = Math.max(
    0,
    Number(customer.points) + points - pointsReset
  );

  const streakResetPoints =
    pointsReset > 0
      ? Number(customer.points) + points - newBalance
      : 0;

  const streakResetReason =
    cyclesCompleted === 1
      ? loyaltyConfig.streakResetReason
      : `${loyaltyConfig.streakResetReason} (${cyclesCompleted} cycles)`;

  const sql = getSql();
  const queries = [
    sql`
      UPDATE customers
      SET
        points = ${newBalance},
        total_points_earned = ${newTotalPointsEarned},
        consecutive_points_earned = ${consecutivePointsEarned},
        vouchers_available = vouchers_available + ${vouchersEarned},
        free_drink_vouchers_available = free_drink_vouchers_available + ${freeDrinkVouchersEarned},
        total_vouchers_earned = total_vouchers_earned + ${vouchersEarned},
        total_free_drink_vouchers_earned = total_free_drink_vouchers_earned + ${freeDrinkVouchersEarned}
      WHERE id = ${input.customerId}
    `,
    sql`
      INSERT INTO transactions (id, customer_id, type, points, reason)
      VALUES (${transactionId}, ${input.customerId}, 'earn', ${points}, ${reason})
    `,
  ];

  for (let i = 0; i < vouchersEarned; i++) {
    queries.push(
      sql`
        INSERT INTO transactions (id, customer_id, type, points, reason)
        VALUES (
          ${generateId("txn")},
          ${input.customerId},
          'voucher_earn',
          0,
          ${loyaltyConfig.voucher.earnReason}
        )
      `
    );
  }

  for (let i = 0; i < freeDrinkVouchersEarned; i++) {
    queries.push(
      sql`
        INSERT INTO transactions (id, customer_id, type, points, reason)
        VALUES (
          ${generateId("txn")},
          ${input.customerId},
          'free_drink_voucher_earn',
          0,
          ${loyaltyConfig.freeDrinkVoucher.earnReason}
        )
      `
    );
  }

  if (streakResetPoints > 0) {
    queries.push(
      sql`
        INSERT INTO transactions (id, customer_id, type, points, reason)
        VALUES (
          ${generateId("txn")},
          ${input.customerId},
          'redeem',
          ${streakResetPoints},
          ${streakResetReason}
        )
      `
    );
  }

  await sql.transaction(queries);

  return {
    id: transactionId,
    customerId: input.customerId,
    type: "earn",
    points,
    reason,
    createdAt: new Date().toISOString(),
  };
}

export async function redeemPoints(
  input: RedeemPointsInput
): Promise<Transaction> {
  const customer = await getCustomerRow(input.customerId);
  if (!customer) throw new Error("Customer not found");
  if (input.points <= 0) throw new Error("Points must be greater than zero");
  if (Number(customer.points) < input.points) {
    throw new Error("Insufficient points");
  }

  const reason = input.reason?.trim() || `Redeemed ${input.points} points`;
  const transactionId = generateId("txn");
  const sql = getSql();

  await sql.transaction([
    sql`
      UPDATE customers
      SET points = points - ${input.points}, consecutive_points_earned = 0
      WHERE id = ${input.customerId}
    `,
    sql`
      INSERT INTO transactions (id, customer_id, type, points, reason)
      VALUES (${transactionId}, ${input.customerId}, 'redeem', ${input.points}, ${reason})
    `,
  ]);

  return {
    id: transactionId,
    customerId: input.customerId,
    type: "redeem",
    points: input.points,
    reason,
    createdAt: new Date().toISOString(),
  };
}

export async function redeemVoucher(
  input: RedeemVoucherInput
): Promise<Transaction> {
  const customer = await getCustomerRow(input.customerId);
  if (!customer) throw new Error("Customer not found");

  const count = input.count ?? 1;
  if (count <= 0 || !Number.isInteger(count)) {
    throw new Error("Voucher count must be a positive whole number.");
  }
  if (Number(customer.vouchers_available) < count) {
    throw new Error(`Only ${customer.vouchers_available} voucher(s) available.`);
  }

  const sql = getSql();
  const queries = [
    sql`
      UPDATE customers
      SET vouchers_available = vouchers_available - ${count}
      WHERE id = ${input.customerId}
    `,
  ];

  const firstId = generateId("txn");
  for (let i = 0; i < count; i++) {
    const txnReason =
      i === 0 && count > 1
        ? input.reason?.trim() ||
          `Redeemed ${count} × ${loyaltyConfig.voucher.label}`
        : input.reason?.trim() || loyaltyConfig.voucher.redeemReason;

    queries.push(
      sql`
        INSERT INTO transactions (id, customer_id, type, points, reason)
        VALUES (
          ${i === 0 ? firstId : generateId("txn")},
          ${input.customerId},
          'voucher_redeem',
          0,
          ${txnReason}
        )
      `
    );
  }

  await sql.transaction(queries);

  return {
    id: firstId,
    customerId: input.customerId,
    type: "voucher_redeem",
    points: 0,
    reason:
      input.reason?.trim() ||
      (count === 1
        ? loyaltyConfig.voucher.redeemReason
        : `Redeemed ${count} × ${loyaltyConfig.voucher.label}`),
    createdAt: new Date().toISOString(),
  };
}

export async function redeemFreeDrinkVoucher(
  input: RedeemFreeDrinkVoucherInput
): Promise<Transaction> {
  const customer = await getCustomerRow(input.customerId);
  if (!customer) throw new Error("Customer not found");

  const count = input.count ?? 1;
  if (count <= 0 || !Number.isInteger(count)) {
    throw new Error("Voucher count must be a positive whole number.");
  }
  if (Number(customer.free_drink_vouchers_available) < count) {
    throw new Error(
      `Only ${customer.free_drink_vouchers_available} free drink voucher(s) available.`
    );
  }

  const sql = getSql();
  const queries = [
    sql`
      UPDATE customers
      SET free_drink_vouchers_available = free_drink_vouchers_available - ${count}
      WHERE id = ${input.customerId}
    `,
  ];

  const firstId = generateId("txn");
  for (let i = 0; i < count; i++) {
    const txnReason =
      i === 0 && count > 1
        ? input.reason?.trim() ||
          `Redeemed ${count} × ${loyaltyConfig.freeDrinkVoucher.label}`
        : input.reason?.trim() || loyaltyConfig.freeDrinkVoucher.redeemReason;

    queries.push(
      sql`
        INSERT INTO transactions (id, customer_id, type, points, reason)
        VALUES (
          ${i === 0 ? firstId : generateId("txn")},
          ${input.customerId},
          'free_drink_voucher_redeem',
          0,
          ${txnReason}
        )
      `
    );
  }

  await sql.transaction(queries);

  return {
    id: firstId,
    customerId: input.customerId,
    type: "free_drink_voucher_redeem",
    points: 0,
    reason:
      input.reason?.trim() ||
      (count === 1
        ? loyaltyConfig.freeDrinkVoucher.redeemReason
        : `Redeemed ${count} × ${loyaltyConfig.freeDrinkVoucher.label}`),
    createdAt: new Date().toISOString(),
  };
}

export async function clearTransactionHistory(): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM transactions`;
}

export async function getTransactionsForCustomer(
  customerId: string
): Promise<Transaction[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM transactions
    WHERE customer_id = ${customerId}
    ORDER BY created_at DESC
  `;
  return (rows as TransactionRow[]).map(mapTransaction);
}

export async function verifyStaffCredentials(
  username: string,
  password: string
): Promise<{ id: string; username: string } | null> {
  const bcrypt = await import("bcryptjs");
  const sql = getSql();
  const rows = await sql`
    SELECT id, username, password_hash
    FROM staff
    WHERE username = ${username.trim()}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const staff = rows[0] as {
    id: string;
    username: string;
    password_hash: string;
  };
  const valid = await bcrypt.compare(password, staff.password_hash);
  if (!valid) return null;

  return { id: staff.id, username: staff.username };
}

export async function ensureAdminStaff(
  username: string,
  password: string,
  name = "Administrator"
): Promise<void> {
  const bcrypt = await import("bcryptjs");
  const sql = getSql();
  const existing = await sql`SELECT id FROM staff WHERE username = ${username}`;
  if (existing.length > 0) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO staff (id, username, password_hash, name)
    VALUES (${generateId("staff")}, ${username}, ${passwordHash}, ${name})
  `;
}
