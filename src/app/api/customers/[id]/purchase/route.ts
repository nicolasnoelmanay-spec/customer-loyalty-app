import { NextRequest } from "next/server";
import { requireStaffSession } from "@/lib/auth/staff-session";
import { handleRouteError, jsonError, jsonResponse } from "@/lib/api/route-utils";
import { getPrismaLoyaltyRepository } from "@/lib/data/prisma-repository";
import type { LogPurchaseInput } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffSession();
    const { id } = await params;
    const body = (await request.json()) as Omit<LogPurchaseInput, "customerId">;

    if (typeof body.drinkCount !== "number" || body.drinkCount <= 0) {
      return jsonError("Drink count must be greater than zero.");
    }

    const repository = getPrismaLoyaltyRepository();
    const transaction = await repository.logPurchase({
      customerId: id,
      drinkCount: body.drinkCount,
      notes: body.notes,
    });
    return jsonResponse(transaction, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
