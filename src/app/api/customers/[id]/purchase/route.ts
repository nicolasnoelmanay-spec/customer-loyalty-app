import { NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { logPurchase } from "@/lib/data/neon-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const drinkCount = body.drinkCount;
    const notes = body.notes?.trim();

    if (
      typeof drinkCount !== "number" ||
      !Number.isInteger(drinkCount) ||
      drinkCount <= 0
    ) {
      return jsonError("drinkCount must be a positive integer.", 400);
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
