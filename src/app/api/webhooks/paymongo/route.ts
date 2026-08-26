import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/route-utils";
import { markQrphPaymentPaid } from "@/lib/paymongo/fulfill-qrph";
import { updateQrphPaymentStatus } from "@/lib/data/qrph-payment-repository";
import { verifyPaymongoWebhookSignature } from "@/lib/paymongo/webhook";
import type { QrphPaymentStatus } from "@/types";

interface PaymongoWebhookPayload {
  data?: {
    attributes?: {
      type?: string;
      data?: {
        id?: string;
        attributes?: {
          payment_intent_id?: string;
          metadata?: Record<string, string | undefined>;
          source?: {
            id?: string;
            type?: string;
          };
        };
      };
    };
  };
}

function extractPaymentIntentId(payload: PaymongoWebhookPayload): string | null {
  const eventData = payload.data?.attributes?.data;
  if (!eventData) return null;

  const fromAttribute = eventData.attributes?.payment_intent_id?.trim();
  if (fromAttribute) return fromAttribute;

  const source = eventData.attributes?.source;
  if (source?.type === "payment_intent" && source.id?.trim()) {
    return source.id.trim();
  }

  if (eventData.id?.startsWith("pi_")) {
    return eventData.id;
  }

  return null;
}

function extractPendingOrderId(payload: PaymongoWebhookPayload): string | null {
  const metadata = payload.data?.attributes?.data?.attributes?.metadata;
  const pendingOrderId =
    metadata?.pending_order_id?.trim() || metadata?.order_id?.trim();
  return pendingOrderId || null;
}

function statusForEvent(eventType: string): QrphPaymentStatus | null {
  switch (eventType) {
    case "payment.paid":
      return "paid";
    case "payment.failed":
      return "failed";
    case "qrph.expired":
      return "expired";
    default:
      return null;
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("paymongo-signature");

    let isValid = false;
    try {
      isValid = verifyPaymongoWebhookSignature(rawBody, signatureHeader);
    } catch (error) {
      console.error("PayMongo webhook secret misconfigured.", error);
      return jsonError("Webhook verification is not configured.", 500);
    }

    if (!isValid) {
      return jsonError("Invalid webhook signature.", 401);
    }

    const payload = JSON.parse(rawBody) as PaymongoWebhookPayload;
    const eventType = payload.data?.attributes?.type?.trim() ?? "";
    const nextStatus = statusForEvent(eventType);

    if (!nextStatus) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const paymentIntentId = extractPaymentIntentId(payload);
    const pendingOrderId = extractPendingOrderId(payload);

    if (nextStatus === "paid") {
      const updated = await markQrphPaymentPaid({
        paymentIntentId: paymentIntentId ?? undefined,
        pendingOrderId: paymentIntentId ? undefined : pendingOrderId ?? undefined,
      });

      if (!updated) {
        console.warn("PayMongo webhook: no matching qrph_payments row.", {
          eventType,
          paymentIntentId,
          pendingOrderId,
        });
      }

      return NextResponse.json({ ok: true, paid: Boolean(updated) });
    }

    const updated = await updateQrphPaymentStatus({
      paymentIntentId: paymentIntentId ?? undefined,
      pendingOrderId: paymentIntentId ? undefined : pendingOrderId ?? undefined,
      status: nextStatus,
    });

    if (!updated) {
      console.warn("PayMongo webhook: no matching qrph_payments row.", {
        eventType,
        paymentIntentId,
        pendingOrderId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to process PayMongo webhook.");
  }
}
