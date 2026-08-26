import { getSql } from "@/lib/db";
import {
  getLatestQrphPaymentForOrder,
  getQrphPaymentByIntentId,
  updateQrphPaymentStatus,
} from "@/lib/data/qrph-payment-repository";
import { retrievePaymentIntent } from "@/lib/paymongo/client";
import type { QrphPayment } from "@/types";

async function markPendingOrderAsGcash(pendingOrderId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE pending_orders
    SET payment_type = ${"gcash"}
    WHERE id = ${pendingOrderId}
  `;
}

/**
 * Mark QR Ph as paid only. Pending order stays in the staff queue until Complete.
 */
export async function markQrphPaymentPaid(input: {
  paymentIntentId?: string;
  pendingOrderId?: string;
}): Promise<QrphPayment | null> {
  let payment: QrphPayment | null = null;

  if (input.paymentIntentId) {
    payment = await updateQrphPaymentStatus({
      paymentIntentId: input.paymentIntentId,
      status: "paid",
    });
    if (!payment) {
      payment = await getQrphPaymentByIntentId(input.paymentIntentId);
    }
  } else if (input.pendingOrderId) {
    payment = await updateQrphPaymentStatus({
      pendingOrderId: input.pendingOrderId,
      status: "paid",
    });
    if (!payment) {
      payment = await getLatestQrphPaymentForOrder(input.pendingOrderId);
    }
  }

  if (!payment) return null;

  if (payment.status !== "paid") {
    const updated = await updateQrphPaymentStatus({
      paymentIntentId: payment.paymentIntentId,
      status: "paid",
    });
    if (updated) payment = updated;
  }

  await markPendingOrderAsGcash(payment.pendingOrderId);
  return payment;
}

/** If local row is still pending, ask PayMongo whether the intent succeeded — mark paid only. */
export async function syncQrphPaymentFromPaymongo(
  pendingOrderId: string
): Promise<QrphPayment | null> {
  const local = await getLatestQrphPaymentForOrder(pendingOrderId);
  if (!local) return null;
  if (local.status === "paid") {
    await markPendingOrderAsGcash(local.pendingOrderId);
    return local;
  }
  if (local.status !== "pending") return null;

  try {
    const remote = await retrievePaymentIntent(local.paymentIntentId);
    if (remote.status === "succeeded") {
      return markQrphPaymentPaid({ paymentIntentId: local.paymentIntentId });
    }
  } catch (error) {
    console.warn("Failed to sync QR Ph status from PayMongo.", error);
  }

  return null;
}
