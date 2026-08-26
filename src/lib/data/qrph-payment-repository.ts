import { getSql } from "@/lib/db";
import { generateId } from "@/lib/data/loyalty-calculations";
import {
  QRPH_PAYMENT_STATUSES,
  type PaymentType,
  type PurchaseItemInput,
  type QrphPayment,
  type QrphPaymentStatus,
  type QrphOrderSnapshot,
  type VoucherApplyOption,
} from "@/types";

interface QrphPaymentRow {
  id: string;
  pending_order_id: string;
  amount: number;
  payment_intent_id: string;
  client_key: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
  paid_at: Date | string | null;
  order_snapshot?: unknown;
}

let qrphPaymentsTableReady: Promise<void> | null = null;

async function ensureQrphPaymentsTable(): Promise<void> {
  if (!qrphPaymentsTableReady) {
    qrphPaymentsTableReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS qrph_payments (
          id TEXT PRIMARY KEY,
          pending_order_id TEXT NOT NULL,
          amount INTEGER NOT NULL,
          payment_intent_id TEXT NOT NULL UNIQUE,
          client_key TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          paid_at TIMESTAMPTZ,
          order_snapshot JSONB
        )
      `;
      await sql`
        ALTER TABLE qrph_payments
        ADD COLUMN IF NOT EXISTS order_snapshot JSONB
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS qrph_payments_pending_order_id_idx
        ON qrph_payments (pending_order_id)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS qrph_payments_created_at_idx
        ON qrph_payments (created_at DESC)
      `;
    })().catch((error) => {
      qrphPaymentsTableReady = null;
      throw error;
    });
  }
  await qrphPaymentsTableReady;
}

function isValidStatus(value: string): value is QrphPaymentStatus {
  return (QRPH_PAYMENT_STATUSES as readonly string[]).includes(value);
}

function parseOrderSnapshot(value: unknown): QrphOrderSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.customerId !== "string") return null;
  if (!Array.isArray(raw.items)) return null;
  return {
    customerId: raw.customerId,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    voucherToApply: (typeof raw.voucherToApply === "string"
      ? raw.voucherToApply
      : "none") as VoucherApplyOption,
    paymentType: (raw.paymentType === "gcash" ? "gcash" : "cash") as PaymentType,
    items: raw.items as PurchaseItemInput[],
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
  };
}

function mapQrphPayment(row: QrphPaymentRow): QrphPayment {
  return {
    id: row.id,
    pendingOrderId: row.pending_order_id,
    amount: Number(row.amount),
    paymentIntentId: row.payment_intent_id,
    clientKey: row.client_key ?? "",
    status: isValidStatus(row.status) ? row.status : "pending",
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    orderSnapshot: parseOrderSnapshot(row.order_snapshot),
  };
}

export async function createQrphPayment(input: {
  pendingOrderId: string;
  amount: number;
  paymentIntentId: string;
  clientKey: string;
  orderSnapshot: QrphOrderSnapshot;
}): Promise<QrphPayment> {
  await ensureQrphPaymentsTable();
  const sql = getSql();
  const id = generateId("qrph");
  const now = new Date().toISOString();

  await sql`
    INSERT INTO qrph_payments (
      id,
      pending_order_id,
      amount,
      payment_intent_id,
      client_key,
      status,
      created_at,
      updated_at,
      paid_at,
      order_snapshot
    )
    VALUES (
      ${id},
      ${input.pendingOrderId},
      ${input.amount},
      ${input.paymentIntentId},
      ${input.clientKey},
      ${"pending"},
      ${now},
      ${now},
      ${null},
      ${JSON.stringify(input.orderSnapshot)}::jsonb
    )
  `;

  const created = await getQrphPaymentById(id);
  if (!created) throw new Error("Failed to save QR Ph payment.");
  return created;
}

export async function getQrphPaymentById(id: string): Promise<QrphPayment | null> {
  await ensureQrphPaymentsTable();
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM qrph_payments
    WHERE id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapQrphPayment(rows[0] as QrphPaymentRow);
}

export async function getQrphPaymentByIntentId(
  paymentIntentId: string
): Promise<QrphPayment | null> {
  await ensureQrphPaymentsTable();
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM qrph_payments
    WHERE payment_intent_id = ${paymentIntentId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapQrphPayment(rows[0] as QrphPaymentRow);
}

export async function getLatestQrphPaymentForOrder(
  pendingOrderId: string
): Promise<QrphPayment | null> {
  await ensureQrphPaymentsTable();
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM qrph_payments
    WHERE pending_order_id = ${pendingOrderId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapQrphPayment(rows[0] as QrphPaymentRow);
}

export async function updateQrphPaymentStatus(input: {
  paymentIntentId?: string;
  pendingOrderId?: string;
  status: QrphPaymentStatus;
}): Promise<QrphPayment | null> {
  await ensureQrphPaymentsTable();
  const sql = getSql();
  const now = new Date().toISOString();
  const paidAt = input.status === "paid" ? now : null;

  if (input.paymentIntentId) {
    const rows = await sql`
      UPDATE qrph_payments
      SET
        status = ${input.status},
        updated_at = ${now},
        paid_at = COALESCE(${paidAt}, paid_at)
      WHERE payment_intent_id = ${input.paymentIntentId}
      RETURNING *
    `;
    if (rows.length === 0) return null;
    return mapQrphPayment(rows[0] as QrphPaymentRow);
  }

  if (input.pendingOrderId) {
    const latest = await getLatestQrphPaymentForOrder(input.pendingOrderId);
    if (!latest) return null;
    const rows = await sql`
      UPDATE qrph_payments
      SET
        status = ${input.status},
        updated_at = ${now},
        paid_at = COALESCE(${paidAt}, paid_at)
      WHERE id = ${latest.id}
      RETURNING *
    `;
    if (rows.length === 0) return null;
    return mapQrphPayment(rows[0] as QrphPaymentRow);
  }

  return null;
}
