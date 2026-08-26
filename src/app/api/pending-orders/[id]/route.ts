import { NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { isValidDrinkTemperature } from "@/lib/data/drink-temperature";
import { isValidQuarterPounderOption } from "@/lib/data/quarter-pounder-options";
import { normalizePaymentType } from "@/lib/data/pending-order-utils";
import {
  deletePendingOrder,
  updatePendingOrder,
} from "@/lib/data/neon-repository";
import { getLatestQrphPaymentForOrder } from "@/lib/data/qrph-payment-repository";
import type { PaymentType, VoucherApplyOption } from "@/types";

const voucherOptions = new Set<VoucherApplyOption>([
  "none",
  "voucher",
  "free-drink-voucher",
]);

const paymentTypes = new Set<PaymentType>(["cash", "gcash"]);

function isValidVoucherApplyOption(value: unknown): value is VoucherApplyOption {
  return typeof value === "string" && voucherOptions.has(value as VoucherApplyOption);
}

function isValidPaymentType(value: unknown): value is PaymentType {
  return typeof value === "string" && paymentTypes.has(value as PaymentType);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return jsonError("Add at least one product.", 400);
    }

    for (const item of items) {
      if (
        typeof item.productId !== "string" ||
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return jsonError("Each item needs a productId and positive quantity.", 400);
      }
      if (
        item.temperature !== undefined &&
        !isValidDrinkTemperature(item.temperature)
      ) {
        return jsonError("Temperature must be hot or iced.", 400);
      }
      if (
        item.quarterPounderOption !== undefined &&
        !isValidQuarterPounderOption(item.quarterPounderOption)
      ) {
        return jsonError("Invalid Quarter Pounder add-on.", 400);
      }
    }

    const voucherToApply = body.voucherToApply;
    if (
      voucherToApply !== undefined &&
      !isValidVoucherApplyOption(voucherToApply)
    ) {
      return jsonError("Invalid voucher selection.", 400);
    }

    let paymentType: PaymentType | undefined;
    if (body.paymentType !== undefined) {
      if (!isValidPaymentType(body.paymentType)) {
        return jsonError("Payment type must be Cash or GCash.", 400);
      }
      paymentType = normalizePaymentType(body.paymentType);
    }

    const order = await updatePendingOrder(id, {
      items,
      notes: typeof body.notes === "string" ? body.notes.trim() : undefined,
      voucherToApply,
      paymentType,
    });

    return NextResponse.json(order);
  } catch (error) {
    return handleRouteError(error, "Failed to update pending order.");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const qrph = await getLatestQrphPaymentForOrder(id);
    if (qrph && (qrph.status === "pending" || qrph.status === "paid")) {
      return jsonError(
        qrph.status === "paid"
          ? "This order has a confirmed QR Ph payment. Tap Complete instead of deleting."
          : "This order has an open QR Ph payment. Complete it or wait for the QR to expire before deleting.",
        409
      );
    }

    await deletePendingOrder(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to delete pending order.");
  }
}
