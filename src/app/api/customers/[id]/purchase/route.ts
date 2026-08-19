import { NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { logPurchase } from "@/lib/data/neon-repository";
import { isValidDrinkTemperature } from "@/lib/data/drink-temperature";
import { normalizePaymentType } from "@/lib/data/pending-order-utils";
import type { PaymentType } from "@/types";

const paymentTypes = new Set<PaymentType>(["cash", "gcash"]);

function isValidPaymentType(value: unknown): value is PaymentType {
  return typeof value === "string" && paymentTypes.has(value as PaymentType);
}

function parseAdditionalSales(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return NaN;
  }
  return value;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const notes = body.notes?.trim();
    const items = body.items;
    const drinkCount = body.drinkCount;
    const additionalSales = parseAdditionalSales(body.additionalSales);
    if (Number.isNaN(additionalSales)) {
      return jsonError("Additional sales must be a whole peso amount of 0 or more.", 400);
    }

    let paymentType: PaymentType | undefined;
    if (body.paymentType !== undefined) {
      if (!isValidPaymentType(body.paymentType)) {
        return jsonError("Payment type must be Cash or GCash.", 400);
      }
      paymentType = normalizePaymentType(body.paymentType);
    }

    if (Array.isArray(items) && items.length > 0) {
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
      }

      const transaction = await logPurchase({
        customerId: id,
        items,
        notes,
        additionalSales,
        paymentType,
      });
      return NextResponse.json(transaction, { status: 201 });
    }

    if (
      typeof drinkCount !== "number" ||
      !Number.isInteger(drinkCount) ||
      drinkCount <= 0
    ) {
      return jsonError("Provide items or a positive drinkCount.", 400);
    }

    const transaction = await logPurchase({
      customerId: id,
      drinkCount,
      notes,
      additionalSales,
      paymentType,
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to log purchase.");
  }
}
