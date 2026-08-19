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
  CreatePendingOrderInput,
  LogPurchaseInput,
  LoyaltyData,
  PendingOrder,
  CompletedOrder,
  Product,
  PurchaseItemInput,
  RedeemFreeDrinkVoucherInput,
  RedeemPointsInput,
  RedeemVoucherInput,
  Transaction,
  UpdateCustomerInput,
  UpdateCustomerProfileInput,
  UpdatePendingOrderInput,
  UpdateCompletedOrderInput,
  VoucherApplyOption,
} from "@/types";
import { generateId, normalizeContact } from "./loyalty-calculations";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_HOURS,
} from "@/lib/auth/password-reset-token";
import { sendPasswordResetEmailSafely } from "@/lib/email/password-reset-email";
import { sendVoucherEarnedEmailSafely } from "@/lib/email/voucher-earned-email";
import {
  mapCustomer,
  mapTransaction,
  type CustomerRow,
  type TransactionRow,
} from "./neon-mappers";
import { mapProduct, type ProductRow } from "./product-mappers";
import {
  calculatePurchaseTotals,
  formatCurrency,
} from "./purchase-calculations";
import {
  normalizePurchaseItem,
  validatePurchaseItemTemperature,
} from "./drink-temperature";
import {
  normalizePurchaseItemQuarterPounderOption,
  validatePurchaseItemQuarterPounderOption,
} from "./quarter-pounder-options";
import {
  enrichPendingOrder,
  enrichCompletedOrder,
  normalizePaymentType,
  type CompletedOrderRecord,
  type PendingOrderRecord,
} from "./pending-order-utils";
import {
  isNonMemberCustomer,
  NON_MEMBER_CUSTOMER_ID,
  NON_MEMBER_CUSTOMER_NAME,
} from "./non-member";

let paymentTypeColumnsReady: Promise<void> | null = null;

async function ensurePaymentTypeColumns(): Promise<void> {
  if (!paymentTypeColumnsReady) {
    paymentTypeColumnsReady = (async () => {
      const sql = getSql();
      await sql`
        ALTER TABLE pending_orders
        ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'cash'
      `;
      await sql`
        ALTER TABLE completed_orders
        ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'cash'
      `;
    })().catch((error) => {
      paymentTypeColumnsReady = null;
      throw error;
    });
  }
  await paymentTypeColumnsReady;
}

async function ensureNonMemberCustomer(): Promise<void> {
  const existing = await getCustomerRow(NON_MEMBER_CUSTOMER_ID);
  if (existing) return;

  const sql = getSql();
  await sql`
    INSERT INTO customers (
      id, name, phone, email, username, password_hash, points, total_points_earned,
      consecutive_points_earned, vouchers_available,
      free_drink_vouchers_available, total_vouchers_earned,
      total_free_drink_vouchers_earned, created_at
    )
    VALUES (
      ${NON_MEMBER_CUSTOMER_ID},
      ${NON_MEMBER_CUSTOMER_NAME},
      ${"N/A"},
      ${"nonmember@coffeesentials.local"},
      ${"customer2"},
      ${null},
      0, 0, 0, 0, 0, 0, 0,
      ${"2026-01-01T00:00:00.000Z"}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

async function fetchCustomers(): Promise<Customer[]> {
  await ensureNonMemberCustomer();
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM customers
    ORDER BY name ASC
  `;
  const customers = (rows as CustomerRow[]).map(mapCustomer);
  return customers.sort((a, b) => {
    if (a.id === NON_MEMBER_CUSTOMER_ID) return -1;
    if (b.id === NON_MEMBER_CUSTOMER_ID) return 1;
    return a.name.localeCompare(b.name);
  });
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

export async function getCustomerById(id: string): Promise<Customer | null> {
  const row = await getCustomerRow(id);
  return row ? mapCustomer(row) : null;
}

export async function authenticateCustomer(input: {
  username: string;
  password: string;
}): Promise<Customer | null> {
  const bcrypt = await import("bcryptjs");
  const identifier = input.username.trim();
  if (!identifier || !input.password) return null;

  const customer = await findCustomerForLogin(identifier);
  if (!customer) return null;

  const row = await getCustomerRow(customer.id);
  if (!row?.password_hash) return null;

  const valid = await bcrypt.compare(input.password, row.password_hash);
  if (!valid) return null;

  return mapCustomer(row);
}

async function findCustomerForLogin(
  identifier: string
): Promise<Customer | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    return findCustomerByEmail(trimmed);
  }

  const byUsername = await findCustomerByUsername(trimmed);
  if (byUsername) return byUsername;

  const byPhone = await findCustomerByPhone(trimmed);
  if (byPhone) return byPhone;

  return findCustomerByEmail(trimmed);
}

export async function getLoyaltyData(): Promise<LoyaltyData> {
  const [customers, transactions] = await Promise.all([
    fetchCustomers(),
    fetchTransactions(),
  ]);
  return { customers, transactions };
}

export async function findCustomerByUsername(
  username: string
): Promise<Customer | null> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return null;

  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM customers
    WHERE LOWER(TRIM(username)) = ${normalized}
    LIMIT 1
  `;
  return rows.length > 0 ? mapCustomer(rows[0] as CustomerRow) : null;
}

export async function findCustomerByEmail(
  email: string
): Promise<Customer | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM customers
    WHERE LOWER(TRIM(email)) = ${normalizeContact(email)}
    LIMIT 1
  `;
  return rows.length > 0 ? mapCustomer(rows[0] as CustomerRow) : null;
}

export async function findCustomerByPhone(
  phone: string
): Promise<Customer | null> {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM customers
    WHERE LOWER(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''))
          LIKE ${"%" + digits + "%"}
       OR phone LIKE ${"%" + trimmed + "%"}
    LIMIT 1
  `;
  return rows.length > 0 ? mapCustomer(rows[0] as CustomerRow) : null;
}

export async function findCustomerByName(
  name: string
): Promise<Customer | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const sql = getSql();
  const exact = await sql`
    SELECT *
    FROM customers
    WHERE LOWER(TRIM(name)) = ${normalized}
    LIMIT 1
  `;
  if (exact.length > 0) {
    return mapCustomer(exact[0] as CustomerRow);
  }

  const partial = await sql`
    SELECT *
    FROM customers
    WHERE LOWER(name) LIKE ${"%" + normalized + "%"}
    ORDER BY LENGTH(name) ASC, name ASC
    LIMIT 1
  `;
  return partial.length > 0 ? mapCustomer(partial[0] as CustomerRow) : null;
}

export async function findCustomerByContact(
  phoneEmailOrName: string
): Promise<Customer | null> {
  const trimmed = phoneEmailOrName.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    return findCustomerByEmail(trimmed);
  }

  const byPhone = await findCustomerByPhone(trimmed);
  if (byPhone) return byPhone;

  return findCustomerByName(trimmed);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const customer = await findCustomerByEmail(email);
  if (!customer) return;

  const row = await getCustomerRow(customer.id);
  if (!row?.password_hash) return;

  const { raw, hash } = generatePasswordResetToken();
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_TOKEN_HOURS * 60 * 60 * 1000
  ).toISOString();
  const tokenId = generateId("prst");
  const sql = getSql();

  await sql.transaction([
    sql`
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE customer_id = ${customer.id} AND used_at IS NULL
    `,
    sql`
      INSERT INTO password_reset_tokens (id, customer_id, token_hash, expires_at)
      VALUES (${tokenId}, ${customer.id}, ${hash}, ${expiresAt})
    `,
  ]);

  await sendPasswordResetEmailSafely({
    name: customer.name,
    email: customer.email,
    token: raw,
  });
}

export async function resetCustomerPassword(input: {
  token: string;
  password: string;
}): Promise<Customer> {
  const password = input.password;
  if (!password || password.length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }

  const tokenHash = hashPasswordResetToken(input.token.trim());
  const sql = getSql();
  const rows = await sql`
    SELECT id, customer_id, expires_at, used_at
    FROM password_reset_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;

  if (rows.length === 0) {
    throw new Error("This reset link is invalid or has expired.");
  }

  const tokenRow = rows[0] as {
    id: string;
    customer_id: string;
    expires_at: string;
    used_at: string | null;
  };

  if (tokenRow.used_at) {
    throw new Error("This reset link has already been used.");
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    throw new Error("This reset link has expired.");
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 10);

  await sql.transaction([
    sql`
      UPDATE customers
      SET password_hash = ${passwordHash}
      WHERE id = ${tokenRow.customer_id}
    `,
    sql`
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE id = ${tokenRow.id}
    `,
    sql`
      DELETE FROM customer_sessions
      WHERE customer_id = ${tokenRow.customer_id}
    `,
  ]);

  const customer = await getCustomerById(tokenRow.customer_id);
  if (!customer) {
    throw new Error("Customer not found.");
  }

  return customer;
}

export async function addCustomer(
  input: CreateCustomerInput
): Promise<Customer> {
  const id = generateId("cust");
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  const password = input.password;

  if (!username || !password) {
    throw new Error("Username and password are required.");
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 10);
  const sql = getSql();

  const rows = await sql`
    INSERT INTO customers (
      id, name, phone, email, username, password_hash, points, total_points_earned,
      consecutive_points_earned, vouchers_available,
      free_drink_vouchers_available, total_vouchers_earned,
      total_free_drink_vouchers_earned
    )
    VALUES (
      ${id}, ${name}, ${phone}, ${email}, ${username}, ${passwordHash}, 0, 0, 0, 0, 0, 0, 0
    )
    RETURNING *
  `;

  return mapCustomer(rows[0] as CustomerRow);
}

export async function registerMember(
  input: CreateCustomerInput
): Promise<Customer> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const username = input.username.trim().toLowerCase();
  const password = input.password;

  if (!name || !phone || !email || !username || !password) {
    throw new Error("All fields are required.");
  }

  const existingUsername = await findCustomerByUsername(username);
  if (existingUsername) {
    throw new Error("That username is already taken.");
  }

  const existing = await findCustomerByEmail(email);
  if (existing) {
    throw new Error("A member with this email is already registered.");
  }

  const existingByPhone = await findCustomerByPhone(phone);
  if (existingByPhone) {
    throw new Error("A member with this phone number is already registered.");
  }

  const customer = await addCustomer({
    name,
    phone,
    email,
    username,
    password,
  });
  return awardRegistrationBonus(customer.id);
}

async function awardRegistrationBonus(customerId: string): Promise<Customer> {
  const bonusPoints = loyaltyConfig.registrationBonusPoints;
  if (bonusPoints <= 0) {
    const customer = await getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");
    return customer;
  }

  const customer = await getCustomerRow(customerId);
  if (!customer) throw new Error("Customer not found");

  const {
    consecutivePointsEarned,
    vouchersEarned,
    freeDrinkVouchersEarned,
    pointsReset,
    cyclesCompleted,
  } = applyStreakPointsEarned(
    Number(customer.consecutive_points_earned),
    bonusPoints
  );

  const newBalance = Math.max(
    0,
    Number(customer.points) + bonusPoints - pointsReset
  );
  const newTotalPointsEarned =
    Number(customer.total_points_earned) + bonusPoints;
  const streakResetPoints =
    pointsReset > 0
      ? Number(customer.points) + bonusPoints - newBalance
      : 0;
  const streakResetReason =
    cyclesCompleted === 1
      ? loyaltyConfig.streakResetReason
      : `${loyaltyConfig.streakResetReason} (${cyclesCompleted} cycles)`;

  const transactionId = generateId("txn");
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
      WHERE id = ${customerId}
    `,
    sql`
      INSERT INTO transactions (id, customer_id, type, points, reason)
      VALUES (
        ${transactionId},
        ${customerId},
        'earn',
        ${bonusPoints},
        ${loyaltyConfig.registrationBonusReason}
      )
    `,
  ];

  for (let i = 0; i < vouchersEarned; i++) {
    queries.push(
      sql`
        INSERT INTO transactions (id, customer_id, type, points, reason)
        VALUES (
          ${generateId("txn")},
          ${customerId},
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
          ${customerId},
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
          ${customerId},
          'redeem',
          ${streakResetPoints},
          ${streakResetReason}
        )
      `
    );
  }

  await sql.transaction(queries);

  const updated = await getCustomerById(customerId);
  if (!updated) throw new Error("Customer not found");
  return updated;
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

export async function deleteCustomer(customerId: string): Promise<void> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM customers
    WHERE id = ${customerId}
    RETURNING id
  `;

  if (rows.length === 0) {
    throw new Error("Customer not found");
  }
}

export async function updateCustomerProfile(
  input: UpdateCustomerProfileInput
): Promise<Customer> {
  const existing = await getCustomerRow(input.customerId);
  if (!existing) throw new Error("Customer not found");

  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();

  if (!name || !phone || !email) {
    throw new Error("Name, phone, and email are required.");
  }

  const existingEmail = await findCustomerByEmail(email);
  if (existingEmail && existingEmail.id !== input.customerId) {
    throw new Error("A member with this email is already registered.");
  }

  const existingByPhone = await findCustomerByPhone(phone);
  if (existingByPhone && existingByPhone.id !== input.customerId) {
    throw new Error("A member with this phone number is already registered.");
  }

  const sql = getSql();
  const rows = await sql`
    UPDATE customers
    SET name = ${name}, phone = ${phone}, email = ${email}
    WHERE id = ${input.customerId}
    RETURNING *
  `;

  return mapCustomer(rows[0] as CustomerRow);
}

export async function getProducts(): Promise<Product[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM products
    WHERE active = TRUE
    ORDER BY category ASC, name ASC
  `;
  return (rows as ProductRow[]).map(mapProduct);
}

export async function logPurchase(
  input: LogPurchaseInput
): Promise<Transaction> {
  const customer = await getCustomerRow(input.customerId);
  if (!customer) throw new Error("Customer not found");

  const notes = input.notes?.trim();
  let points: number;
  let reason: string;

  if (input.items && input.items.length > 0) {
    const selectedItems = input.items.filter((item) => item.quantity > 0);
    if (selectedItems.length === 0) {
      throw new Error("Add at least one product.");
    }

    for (const item of selectedItems) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error("Invalid product quantity.");
      }
    }

    const catalog = await getProducts();
    const productIds = new Set(selectedItems.map((item) => item.productId));
    const products = catalog.filter((product) => productIds.has(product.id));

    if (products.length !== productIds.size) {
      throw new Error("One or more products were not found.");
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const normalizedItems = selectedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw new Error("One or more products were not found.");
      validatePurchaseItemTemperature(item, product);
      validatePurchaseItemQuarterPounderOption(item, product);
      const normalizedTemperature = normalizePurchaseItem(item, product);
      return normalizePurchaseItemQuarterPounderOption(
        normalizedTemperature,
        product
      );
    });

    const totals = calculatePurchaseTotals(normalizedItems, products);
    points = totals.pointsEarned;
    reason = `${totals.summary} (${formatCurrency(totals.subtotal)})`;
    if (notes) reason += ` — ${notes}`;
  } else {
    const drinkCount = input.drinkCount;
    if (
      typeof drinkCount !== "number" ||
      !Number.isInteger(drinkCount) ||
      drinkCount <= 0
    ) {
      throw new Error("Enter a valid purchase.");
    }

    points = calculatePointsFromDrinks(drinkCount);
    const drinkSummary = formatDrinkCount(drinkCount);
    reason = notes ? `${drinkSummary} — ${notes}` : drinkSummary;
  }

  const additionalSales =
    typeof input.additionalSales === "number" &&
    Number.isInteger(input.additionalSales) &&
    input.additionalSales > 0
      ? input.additionalSales
      : 0;
  if (additionalSales > 0) {
    reason = `${reason} — Additional sales ${formatCurrency(additionalSales)}`;
  }

  if (isNonMemberCustomer(input.customerId)) {
    points = 0;
    reason = `${reason} — Non-member (no loyalty)`;
  }

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

  if (additionalSales > 0) {
    await ensurePaymentTypeColumns();
    const paymentType = normalizePaymentType(input.paymentType);
    const orderNotes = notes
      ? `Logged with coffee drinks — ${notes}`
      : "Logged with coffee drinks";
    await sql`
      INSERT INTO completed_orders (
        id,
        customer_id,
        transaction_id,
        notes,
        voucher_to_apply,
        payment_type,
        items,
        subtotal,
        discount,
        total,
        points_earned,
        created_at,
        completed_at
      )
      VALUES (
        ${generateId("order")},
        ${input.customerId},
        ${transactionId},
        ${orderNotes},
        ${"none"},
        ${paymentType},
        ${JSON.stringify([])}::jsonb,
        ${additionalSales},
        0,
        ${additionalSales},
        0,
        NOW(),
        NOW()
      )
    `;
  }

  if (vouchersEarned > 0 || freeDrinkVouchersEarned > 0) {
    await sendVoucherEarnedEmailSafely({
      name: customer.name,
      email: customer.email,
      halfOffVouchersEarned: vouchersEarned,
      freeDrinkVouchersEarned: freeDrinkVouchersEarned,
      vouchersAvailable:
        Number(customer.vouchers_available) + vouchersEarned,
      freeDrinkVouchersAvailable:
        Number(customer.free_drink_vouchers_available) +
        freeDrinkVouchersEarned,
      pointsBalance: newBalance,
    });
  }

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

export async function deleteTransaction(transactionId: string): Promise<void> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM transactions WHERE id = ${transactionId} RETURNING id
  `;
  if (rows.length === 0) {
    throw new Error("Transaction not found.");
  }
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

function parsePendingOrderItems(value: unknown): PurchaseItemInput[] {
  if (!Array.isArray(value)) {
    throw new Error("Invalid pending order items.");
  }
  return value as PurchaseItemInput[];
}

async function normalizePendingOrderItems(
  items: PurchaseItemInput[],
  products: Product[]
): Promise<PurchaseItemInput[]> {
  const productMap = new Map(products.map((product) => [product.id, product]));

  return items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error("One or more products were not found.");
    }
    validatePurchaseItemTemperature(item, product);
    validatePurchaseItemQuarterPounderOption(item, product);
    const normalizedTemperature = normalizePurchaseItem(item, product);
    return normalizePurchaseItemQuarterPounderOption(
      normalizedTemperature,
      product
    );
  });
}

export async function getPendingOrders(): Promise<PendingOrder[]> {
  await ensurePaymentTypeColumns();
  const sql = getSql();
  const [rows, products] = await Promise.all([
    sql`
      SELECT
        po.id,
        po.customer_id,
        c.name AS customer_name,
        po.notes,
        po.voucher_to_apply,
        po.payment_type,
        po.items,
        po.created_at
      FROM pending_orders po
      INNER JOIN customers c ON c.id = po.customer_id
      ORDER BY po.created_at DESC
    `,
    getProducts(),
  ]);

  return (rows as PendingOrderRecord[]).map((row) =>
    enrichPendingOrder(
      {
        ...row,
        items: parsePendingOrderItems(row.items),
      },
      products
    )
  );
}

export async function getPendingOrderById(
  orderId: string
): Promise<PendingOrder | null> {
  await ensurePaymentTypeColumns();
  const sql = getSql();
  const [rows, products] = await Promise.all([
    sql`
      SELECT
        po.id,
        po.customer_id,
        c.name AS customer_name,
        po.notes,
        po.voucher_to_apply,
        po.payment_type,
        po.items,
        po.created_at
      FROM pending_orders po
      INNER JOIN customers c ON c.id = po.customer_id
      WHERE po.id = ${orderId}
      LIMIT 1
    `,
    getProducts(),
  ]);

  if (rows.length === 0) return null;

  const row = rows[0] as PendingOrderRecord;
  return enrichPendingOrder(
    {
      ...row,
      items: parsePendingOrderItems(row.items),
    },
    products
  );
}

export async function createPendingOrder(
  input: CreatePendingOrderInput
): Promise<PendingOrder> {
  const customer = await getCustomerRow(input.customerId);
  if (!customer) throw new Error("Customer not found.");

  const selectedItems = input.items.filter((item) => item.quantity > 0);
  if (selectedItems.length === 0) {
    throw new Error("Add at least one product.");
  }

  for (const item of selectedItems) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Invalid product quantity.");
    }
  }

  const catalog = await getProducts();
  const normalizedItems = await normalizePendingOrderItems(
    selectedItems,
    catalog
  );

  let voucherToApply = input.voucherToApply ?? "none";
  if (isNonMemberCustomer(input.customerId)) {
    voucherToApply = "none";
  }
  if (voucherToApply === "voucher" && Number(customer.vouchers_available) <= 0) {
    throw new Error("No 50% off vouchers available for this customer.");
  }
  if (
    voucherToApply === "free-drink-voucher" &&
    Number(customer.free_drink_vouchers_available) <= 0
  ) {
    throw new Error("No free drink vouchers available for this customer.");
  }

  const paymentType = normalizePaymentType(input.paymentType);
  const orderId = generateId("order");
  await ensurePaymentTypeColumns();
  const sql = getSql();
  await sql`
    INSERT INTO pending_orders (
      id,
      customer_id,
      notes,
      voucher_to_apply,
      payment_type,
      items
    )
    VALUES (
      ${orderId},
      ${input.customerId},
      ${input.notes?.trim() ?? ""},
      ${voucherToApply},
      ${paymentType},
      ${JSON.stringify(normalizedItems)}::jsonb
    )
  `;

  const created = await getPendingOrderById(orderId);
  if (!created) throw new Error("Failed to create pending order.");
  return created;
}

export async function updatePendingOrder(
  orderId: string,
  input: UpdatePendingOrderInput
): Promise<PendingOrder> {
  const existing = await getPendingOrderById(orderId);
  if (!existing) throw new Error("Pending order not found.");

  const customer = await getCustomerRow(existing.customerId);
  if (!customer) throw new Error("Customer not found.");

  const selectedItems = input.items.filter((item) => item.quantity > 0);
  if (selectedItems.length === 0) {
    throw new Error("Add at least one product.");
  }

  for (const item of selectedItems) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Invalid product quantity.");
    }
  }

  const catalog = await getProducts();
  const normalizedItems = await normalizePendingOrderItems(
    selectedItems,
    catalog
  );

  let voucherToApply = input.voucherToApply ?? existing.voucherToApply;
  if (isNonMemberCustomer(existing.customerId)) {
    voucherToApply = "none";
  }
  if (voucherToApply === "voucher" && Number(customer.vouchers_available) <= 0) {
    throw new Error("No 50% off vouchers available for this customer.");
  }
  if (
    voucherToApply === "free-drink-voucher" &&
    Number(customer.free_drink_vouchers_available) <= 0
  ) {
    throw new Error("No free drink vouchers available for this customer.");
  }

  const notes =
    typeof input.notes === "string" ? input.notes.trim() : existing.notes;
  const paymentType =
    input.paymentType !== undefined
      ? normalizePaymentType(input.paymentType)
      : existing.paymentType;

  await ensurePaymentTypeColumns();
  const sql = getSql();
  const rows = await sql`
    UPDATE pending_orders
    SET
      items = ${JSON.stringify(normalizedItems)}::jsonb,
      notes = ${notes},
      voucher_to_apply = ${voucherToApply},
      payment_type = ${paymentType}
    WHERE id = ${orderId}
    RETURNING id
  `;
  if (rows.length === 0) {
    throw new Error("Pending order not found.");
  }

  const updated = await getPendingOrderById(orderId);
  if (!updated) throw new Error("Failed to update pending order.");
  return updated;
}

export async function deletePendingOrder(orderId: string): Promise<void> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM pending_orders WHERE id = ${orderId} RETURNING id
  `;
  if (rows.length === 0) {
    throw new Error("Pending order not found.");
  }
}

export async function getCompletedOrders(): Promise<CompletedOrder[]> {
  await ensurePaymentTypeColumns();
  const sql = getSql();
  const rows = await sql`
    SELECT
      co.id,
      co.customer_id,
      c.name AS customer_name,
      co.transaction_id,
      co.notes,
      co.voucher_to_apply,
      co.payment_type,
      co.items,
      co.subtotal,
      co.discount,
      co.total,
      co.points_earned,
      co.created_at,
      co.completed_at
    FROM completed_orders co
    INNER JOIN customers c ON c.id = co.customer_id
    ORDER BY co.completed_at DESC
  `;

  return (rows as CompletedOrderRecord[]).map((row) =>
    enrichCompletedOrder({
      ...row,
      items: parsePendingOrderItems(row.items),
    })
  );
}

export async function getCompletedOrderById(
  orderId: string
): Promise<CompletedOrder | null> {
  await ensurePaymentTypeColumns();
  const sql = getSql();
  const rows = await sql`
    SELECT
      co.id,
      co.customer_id,
      c.name AS customer_name,
      co.transaction_id,
      co.notes,
      co.voucher_to_apply,
      co.payment_type,
      co.items,
      co.subtotal,
      co.discount,
      co.total,
      co.points_earned,
      co.created_at,
      co.completed_at
    FROM completed_orders co
    INNER JOIN customers c ON c.id = co.customer_id
    WHERE co.id = ${orderId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0] as CompletedOrderRecord;
  return enrichCompletedOrder({
    ...row,
    items: parsePendingOrderItems(row.items),
  });
}

export async function updateCompletedOrder(
  orderId: string,
  input: UpdateCompletedOrderInput
): Promise<CompletedOrder> {
  const existing = await getCompletedOrderById(orderId);
  if (!existing) throw new Error("Completed order not found.");

  const selectedItems = input.items.filter((item) => item.quantity > 0);
  if (selectedItems.length === 0) {
    throw new Error("Add at least one product.");
  }

  for (const item of selectedItems) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Invalid product quantity.");
    }
  }

  const catalog = await getProducts();
  const normalizedItems = await normalizePendingOrderItems(
    selectedItems,
    catalog
  );

  const notes =
    typeof input.notes === "string" ? input.notes.trim() : existing.notes;
  const paymentType =
    input.paymentType !== undefined
      ? normalizePaymentType(input.paymentType)
      : existing.paymentType;

  let voucherToApply = input.voucherToApply ?? existing.voucherToApply;
  if (isNonMemberCustomer(existing.customerId)) {
    voucherToApply = "none";
  }

  const customerBefore = await getCustomerRow(existing.customerId);
  if (!customerBefore) throw new Error("Customer not found.");

  const vouchersAfterReverse =
    Number(customerBefore.vouchers_available) +
    (existing.voucherToApply === "voucher" ? 1 : 0);
  const freeDrinkAfterReverse =
    Number(customerBefore.free_drink_vouchers_available) +
    (existing.voucherToApply === "free-drink-voucher" ? 1 : 0);

  if (voucherToApply === "voucher" && vouchersAfterReverse <= 0) {
    throw new Error("No 50% off vouchers available for this customer.");
  }
  if (voucherToApply === "free-drink-voucher" && freeDrinkAfterReverse <= 0) {
    throw new Error("No free drink vouchers available for this customer.");
  }

  await reverseCompletedOrderLoyalty(existing);

  const transaction = await logPurchase({
    customerId: existing.customerId,
    items: normalizedItems,
    notes: notes || undefined,
  });

  if (voucherToApply === "voucher") {
    await redeemVoucher({ customerId: existing.customerId, count: 1 });
  } else if (voucherToApply === "free-drink-voucher") {
    await redeemFreeDrinkVoucher({ customerId: existing.customerId, count: 1 });
  }

  const enriched = enrichPendingOrder(
    {
      id: existing.id,
      customer_id: existing.customerId,
      customer_name: existing.customerName,
      notes,
      voucher_to_apply: voucherToApply,
      payment_type: paymentType,
      items: normalizedItems,
      created_at: existing.createdAt,
    },
    catalog
  );

  await ensurePaymentTypeColumns();
  const sql = getSql();
  const rows = await sql`
    UPDATE completed_orders
    SET
      transaction_id = ${transaction.id},
      notes = ${notes},
      voucher_to_apply = ${voucherToApply},
      payment_type = ${paymentType},
      items = ${JSON.stringify(normalizedItems)}::jsonb,
      subtotal = ${enriched.subtotal},
      discount = ${enriched.discount},
      total = ${enriched.total},
      points_earned = ${enriched.pointsEarned}
    WHERE id = ${orderId}
    RETURNING id
  `;
  if (rows.length === 0) {
    throw new Error("Completed order not found.");
  }

  const updated = await getCompletedOrderById(orderId);
  if (!updated) throw new Error("Failed to update completed order.");
  return updated;
}

async function reverseCompletedOrderLoyalty(
  order: CompletedOrder
): Promise<void> {
  const customer = await getCustomerRow(order.customerId);
  if (!customer) throw new Error("Customer not found.");

  const sql = getSql();
  const relatedTxns = await sql`
    SELECT id, type, points, reason
    FROM transactions
    WHERE customer_id = ${order.customerId}
      AND created_at >= ${order.completedAt}::timestamptz - INTERVAL '2 minutes'
      AND created_at <= ${order.completedAt}::timestamptz + INTERVAL '2 minutes'
    ORDER BY created_at ASC
  `;

  type RelatedTxn = {
    id: string;
    type: string;
    points: number;
    reason: string;
  };

  const related = relatedTxns as RelatedTxn[];
  const relatedIds = new Set(related.map((txn) => txn.id));
  if (order.transactionId) {
    relatedIds.add(order.transactionId);
  }

  let pointsDelta = 0;
  let totalPointsEarnedDelta = 0;
  let consecutiveDelta = 0;
  let vouchersAvailableDelta = 0;
  let freeDrinkVouchersAvailableDelta = 0;
  let totalVouchersEarnedDelta = 0;
  let totalFreeDrinkVouchersEarnedDelta = 0;
  let restoredRedeemVoucher = false;
  let restoredRedeemFreeDrink = false;

  for (const txn of related) {
    if (txn.type === "earn") {
      const points = Number(txn.points);
      pointsDelta -= points;
      totalPointsEarnedDelta -= points;
      consecutiveDelta -= points;
      continue;
    }
    if (txn.type === "redeem") {
      pointsDelta += Number(txn.points);
      continue;
    }
    if (txn.type === "voucher_earn") {
      vouchersAvailableDelta -= 1;
      totalVouchersEarnedDelta -= 1;
      continue;
    }
    if (txn.type === "free_drink_voucher_earn") {
      freeDrinkVouchersAvailableDelta -= 1;
      totalFreeDrinkVouchersEarnedDelta -= 1;
      continue;
    }
    if (txn.type === "voucher_redeem") {
      vouchersAvailableDelta += 1;
      restoredRedeemVoucher = true;
      continue;
    }
    if (txn.type === "free_drink_voucher_redeem") {
      freeDrinkVouchersAvailableDelta += 1;
      restoredRedeemFreeDrink = true;
    }
  }

  if (related.every((txn) => txn.type !== "earn") && order.pointsEarned > 0) {
    pointsDelta -= order.pointsEarned;
    totalPointsEarnedDelta -= order.pointsEarned;
    consecutiveDelta -= order.pointsEarned;
  }

  if (order.voucherToApply === "voucher" && !restoredRedeemVoucher) {
    vouchersAvailableDelta += 1;
  }
  if (
    order.voucherToApply === "free-drink-voucher" &&
    !restoredRedeemFreeDrink
  ) {
    freeDrinkVouchersAvailableDelta += 1;
  }

  const nextPoints = Math.max(0, Number(customer.points) + pointsDelta);
  const nextTotalPointsEarned = Math.max(
    0,
    Number(customer.total_points_earned) + totalPointsEarnedDelta
  );
  const nextConsecutive = Math.max(
    0,
    Number(customer.consecutive_points_earned) + consecutiveDelta
  );
  const nextVouchers = Math.max(
    0,
    Number(customer.vouchers_available) + vouchersAvailableDelta
  );
  const nextFreeDrink = Math.max(
    0,
    Number(customer.free_drink_vouchers_available) +
      freeDrinkVouchersAvailableDelta
  );
  const nextTotalVouchers = Math.max(
    0,
    Number(customer.total_vouchers_earned) + totalVouchersEarnedDelta
  );
  const nextTotalFreeDrink = Math.max(
    0,
    Number(customer.total_free_drink_vouchers_earned) +
      totalFreeDrinkVouchersEarnedDelta
  );

  const txnIds = Array.from(relatedIds);
  const queries = [
    sql`
      UPDATE customers
      SET
        points = ${nextPoints},
        total_points_earned = ${nextTotalPointsEarned},
        consecutive_points_earned = ${nextConsecutive},
        vouchers_available = ${nextVouchers},
        free_drink_vouchers_available = ${nextFreeDrink},
        total_vouchers_earned = ${nextTotalVouchers},
        total_free_drink_vouchers_earned = ${nextTotalFreeDrink}
      WHERE id = ${order.customerId}
    `,
    sql`
      UPDATE completed_orders
      SET transaction_id = NULL
      WHERE id = ${order.id}
    `,
  ];

  for (const txnId of txnIds) {
    queries.push(sql`DELETE FROM transactions WHERE id = ${txnId}`);
  }

  await sql.transaction(queries);
}

export async function getCustomerTotalVoucherSavings(
  customerId: string
): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COALESCE(SUM(discount), 0)::int AS total
    FROM completed_orders
    WHERE customer_id = ${customerId}
  `;
  return Number(rows[0]?.total ?? 0);
}

async function saveCompletedOrder(
  record: PendingOrderRecord,
  products: Product[],
  transactionId: string
): Promise<void> {
  const enriched = enrichPendingOrder(record, products);
  const sql = getSql();
  await ensurePaymentTypeColumns();
  await sql`
    INSERT INTO completed_orders (
      id,
      customer_id,
      transaction_id,
      notes,
      voucher_to_apply,
      payment_type,
      items,
      subtotal,
      discount,
      total,
      points_earned,
      created_at,
      completed_at
    )
    VALUES (
      ${record.id},
      ${record.customer_id},
      ${transactionId},
      ${record.notes},
      ${record.voucher_to_apply},
      ${normalizePaymentType(record.payment_type)},
      ${JSON.stringify(record.items)}::jsonb,
      ${enriched.subtotal},
      ${enriched.discount},
      ${enriched.total},
      ${enriched.pointsEarned},
      ${record.created_at},
      NOW()
    )
  `;
}

export async function completePendingOrder(orderId: string): Promise<Transaction> {
  await ensurePaymentTypeColumns();
  const sql = getSql();
  const [rows, products] = await Promise.all([
    sql`
      SELECT
        po.id,
        po.customer_id,
        c.name AS customer_name,
        po.notes,
        po.voucher_to_apply,
        po.payment_type,
        po.items,
        po.created_at
      FROM pending_orders po
      INNER JOIN customers c ON c.id = po.customer_id
      WHERE po.id = ${orderId}
    `,
    getProducts(),
  ]);

  if (rows.length === 0) {
    throw new Error("Pending order not found.");
  }

  const record = rows[0] as PendingOrderRecord;
  const items = parsePendingOrderItems(record.items);
  let voucherToApply = record.voucher_to_apply as VoucherApplyOption;
  if (isNonMemberCustomer(record.customer_id)) {
    voucherToApply = "none";
  }

  const transaction = await logPurchase({
    customerId: record.customer_id,
    items,
    notes: record.notes || undefined,
  });

  if (voucherToApply === "voucher") {
    await redeemVoucher({ customerId: record.customer_id, count: 1 });
  } else if (voucherToApply === "free-drink-voucher") {
    await redeemFreeDrinkVoucher({ customerId: record.customer_id, count: 1 });
  }

  await saveCompletedOrder(
    { ...record, voucher_to_apply: voucherToApply },
    products,
    transaction.id
  );
  await deletePendingOrder(orderId);
  return transaction;
}
