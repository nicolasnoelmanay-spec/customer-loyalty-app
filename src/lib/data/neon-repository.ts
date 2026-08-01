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
} from "@/types";
import { generateId, normalizeContact } from "./loyalty-calculations";
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
  enrichPendingOrder,
  enrichCompletedOrder,
  type CompletedOrderRecord,
  type PendingOrderRecord,
} from "./pending-order-utils";

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

export async function getCustomerById(id: string): Promise<Customer | null> {
  const row = await getCustomerRow(id);
  return row ? mapCustomer(row) : null;
}

export async function authenticateCustomer(input: {
  username: string;
  password: string;
}): Promise<Customer | null> {
  const bcrypt = await import("bcryptjs");
  const username = input.username.trim().toLowerCase();
  if (!username || !input.password) return null;

  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM customers
    WHERE LOWER(TRIM(username)) = ${username}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0] as CustomerRow & { password_hash: string | null };
  if (!row.password_hash) return null;

  const valid = await bcrypt.compare(input.password, row.password_hash);
  if (!valid) return null;

  return mapCustomer(row);
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

export async function findCustomerByContact(
  phoneOrEmail: string
): Promise<Customer | null> {
  const trimmed = phoneOrEmail.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    return findCustomerByEmail(trimmed);
  }

  return findCustomerByPhone(trimmed);
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

  return addCustomer({ name, phone, email, username, password });
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
    ORDER BY sort_order ASC, name ASC
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
      return normalizePurchaseItem(item, product);
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
    return normalizePurchaseItem(item, product);
  });
}

export async function getPendingOrders(): Promise<PendingOrder[]> {
  const sql = getSql();
  const [rows, products] = await Promise.all([
    sql`
      SELECT
        po.id,
        po.customer_id,
        c.name AS customer_name,
        po.notes,
        po.voucher_to_apply,
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

  const voucherToApply = input.voucherToApply ?? "none";
  if (voucherToApply === "voucher" && Number(customer.vouchers_available) <= 0) {
    throw new Error("No 50% off vouchers available for this customer.");
  }
  if (
    voucherToApply === "free-drink-voucher" &&
    Number(customer.free_drink_vouchers_available) <= 0
  ) {
    throw new Error("No free drink vouchers available for this customer.");
  }

  const orderId = generateId("order");
  const sql = getSql();
  await sql`
    INSERT INTO pending_orders (
      id,
      customer_id,
      notes,
      voucher_to_apply,
      items
    )
    VALUES (
      ${orderId},
      ${input.customerId},
      ${input.notes?.trim() ?? ""},
      ${voucherToApply},
      ${JSON.stringify(normalizedItems)}::jsonb
    )
  `;

  const orders = await getPendingOrders();
  const created = orders.find((order) => order.id === orderId);
  if (!created) throw new Error("Failed to create pending order.");
  return created;
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
  const sql = getSql();
  const rows = await sql`
    SELECT
      co.id,
      co.customer_id,
      c.name AS customer_name,
      co.transaction_id,
      co.notes,
      co.voucher_to_apply,
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
  await sql`
    INSERT INTO completed_orders (
      id,
      customer_id,
      transaction_id,
      notes,
      voucher_to_apply,
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
  const sql = getSql();
  const [rows, products] = await Promise.all([
    sql`
      SELECT
        po.id,
        po.customer_id,
        c.name AS customer_name,
        po.notes,
        po.voucher_to_apply,
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
  const voucherToApply = record.voucher_to_apply as CreatePendingOrderInput["voucherToApply"];

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

  await saveCompletedOrder(record, products, transaction.id);
  await deletePendingOrder(orderId);
  return transaction;
}
