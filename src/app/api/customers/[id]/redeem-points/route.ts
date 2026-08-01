import { NextRequest } from "next/server";
import { requireStaffSession } from "@/lib/auth/staff-session";
import { handleRouteError, jsonError, jsonResponse } from "@/lib/api/route-utils";
import { getPrismaLoyaltyRepository } from "@/lib/data/prisma-repository";
import type { RedeemPointsInput } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffSession();
    const { id } = await params;
    const body = (await request.json()) as Omit<RedeemPointsInput, "customerId">;

    if (typeof body.points !== "number") {
      return jsonError("Points are required.");
    }

    const repository = getPrismaLoyaltyRepository();
    const transaction = await repository.redeemPoints({
      customerId: id,
      points: body.points,
      reason: body.reason,
    });
    return jsonResponse(transaction, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
