import { NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { isValidDrinkTemperature } from "@/lib/data/drink-temperature";
import { isValidQuarterPounderOption } from "@/lib/data/quarter-pounder-options";
import { normalizePaymentType } from "@/lib/data/pending-order-utils";
import { createPendingOrder, getPendingOrders } from "@/lib/data/neon-repository";
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

export async function GET() {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const orders = await getPendingOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    return handleRouteError(error, "Failed to load pending orders.");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const items = body.items;
    const customerId = body.customerId;

    if (typeof customerId !== "string" || !customerId.trim()) {
      return jsonError("Customer is required.", 400);
    }

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

    const voucherToApply = body.voucherToApply ?? "none";
    if (!isValidVoucherApplyOption(voucherToApply)) {
      return jsonError("Invalid voucher selection.", 400);
    }

    const paymentType =
      body.paymentType === undefined
        ? "cash"
        : isValidPaymentType(body.paymentType)
          ? body.paymentType
          : null;
    if (paymentType === null) {
      return jsonError("Payment type must be Cash or GCash.", 400);
    }

    const order = await createPendingOrder({
      customerId,
      items,
      notes: typeof body.notes === "string" ? body.notes.trim() : undefined,
      voucherToApply,
      paymentType: normalizePaymentType(paymentType),
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to create pending order.");
  }
}
