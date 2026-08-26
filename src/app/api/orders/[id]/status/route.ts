import { NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { getPendingOrderById } from "@/lib/data/neon-repository";
import { getLatestQrphPaymentForOrder } from "@/lib/data/qrph-payment-repository";
import { syncQrphPaymentFromPaymongo } from "@/lib/paymongo/fulfill-qrph";
import type { QrphOrderPaymentStatus } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const orderId = id?.trim() ?? "";
    if (!orderId) {
      return jsonError("Order ID is required.", 400);
    }

    // Recover paid status when PayMongo succeeded but webhook never reached this app.
    await syncQrphPaymentFromPaymongo(orderId);

    const [order, payment] = await Promise.all([
      getPendingOrderById(orderId),
      getLatestQrphPaymentForOrder(orderId),
    ]);

    if (!order && !payment) {
      return jsonError("Order payment not found.", 404);
    }

    const result: QrphOrderPaymentStatus = payment
      ? {
          status: payment.status,
          amount: payment.amount,
          paymentIntentId: payment.paymentIntentId,
          paidAt: payment.paidAt,
          pendingOrderExists: Boolean(order),
        }
      : {
          status: "none",
          amount: null,
          paymentIntentId: null,
          paidAt: null,
          pendingOrderExists: true,
        };

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Failed to load order payment status.");
  }
}
