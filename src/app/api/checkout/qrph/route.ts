import { NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { getPendingOrderById } from "@/lib/data/neon-repository";
import { createQrphPayment } from "@/lib/data/qrph-payment-repository";
import {
  attachQrphPaymentIntent,
  createQrphPaymentIntent,
  createQrphPaymentMethod,
  pesosToCentavos,
} from "@/lib/paymongo/client";
import type { CreateQrphCheckoutResult } from "@/types";

export async function POST(request: Request) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const orderId =
      typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) {
      return jsonError("Order ID is required.", 400);
    }

    const order = await getPendingOrderById(orderId);
    if (!order) {
      return jsonError("Pending order not found.", 404);
    }

    if (!Number.isInteger(order.total) || order.total <= 0) {
      return jsonError("Order total must be a positive peso amount.", 400);
    }

    if (body.amount !== undefined) {
      const clientAmount =
        typeof body.amount === "number"
          ? body.amount
          : typeof body.amount === "string"
            ? Number(body.amount)
            : NaN;
      if (!Number.isInteger(clientAmount) || clientAmount !== order.total) {
        return jsonError(
          "Amount must match the pending order total.",
          400
        );
      }
    }

    const paymentIntent = await createQrphPaymentIntent({
      amountCentavos: pesosToCentavos(order.total),
      description: `Pending order ${order.id} — ${order.customerName}`,
      pendingOrderId: order.id,
    });

    const paymentMethod = await createQrphPaymentMethod();
    const attached = await attachQrphPaymentIntent({
      paymentIntentId: paymentIntent.id,
      paymentMethodId: paymentMethod.id,
      clientKey: paymentIntent.clientKey,
    });

    await createQrphPayment({
      pendingOrderId: order.id,
      amount: order.total,
      paymentIntentId: paymentIntent.id,
      clientKey: paymentIntent.clientKey,
      orderSnapshot: {
        customerId: order.customerId,
        notes: order.notes,
        voucherToApply: order.voucherToApply,
        paymentType: "gcash",
        items: order.items.map((item) => ({ ...item })),
        createdAt: order.createdAt,
      },
    });

    const result: CreateQrphCheckoutResult = {
      paymentIntentId: paymentIntent.id,
      qrCodeUrl: attached.qrCodeUrl,
      orderId: order.id,
      amount: order.total,
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to create QR Ph checkout.");
  }
}
