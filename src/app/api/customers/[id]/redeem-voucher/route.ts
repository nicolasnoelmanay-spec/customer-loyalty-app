import { NextRequest } from "next/server";
import { requireStaffSession } from "@/lib/auth/staff-session";
import { ensureDbReady, handleRouteError, jsonResponse } from "@/lib/api/route-utils";
import { getPrismaLoyaltyRepository } from "@/lib/data/prisma-repository";
import type { RedeemVoucherInput } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbReady();
    await requireStaffSession();
    const { id } = await params;
    const body = (await request.json()) as Omit<RedeemVoucherInput, "customerId">;

    const repository = getPrismaLoyaltyRepository();
    const transaction = await repository.redeemVoucher({
      customerId: id,
      count: body.count,
      reason: body.reason,
    });
    return jsonResponse(transaction, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
