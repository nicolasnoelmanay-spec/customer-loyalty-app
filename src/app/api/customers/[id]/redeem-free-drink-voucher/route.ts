import { NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { redeemFreeDrinkVoucher } from "@/lib/data/neon-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const count = body.count ?? 1;
    const reason = body.reason?.trim();

    if (typeof count !== "number" || !Number.isInteger(count) || count <= 0) {
      return jsonError("count must be a positive integer.", 400);
    }

    const transaction = await redeemFreeDrinkVoucher({
      customerId: id,
      count,
      reason,
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to redeem free drink voucher.");
  }
}
