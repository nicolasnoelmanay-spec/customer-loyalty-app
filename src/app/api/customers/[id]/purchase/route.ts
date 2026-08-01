import { NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { logPurchase } from "@/lib/data/neon-repository";
import { isValidDrinkTemperature } from "@/lib/data/drink-temperature";

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
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to log purchase.");
  }
}
