import { NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { redeemPoints } from "@/lib/data/neon-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const points = body.points;
    const reason = body.reason?.trim();

    if (typeof points !== "number" || !Number.isInteger(points) || points <= 0) {
      return jsonError("points must be a positive integer.", 400);
    }

    const transaction = await redeemPoints({
      customerId: id,
      points,
      reason,
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to redeem points.");
  }
}
