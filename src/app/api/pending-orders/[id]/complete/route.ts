import { NextResponse } from "next/server";
import {
  handleRouteError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { completePendingOrder } from "@/lib/data/neon-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const transaction = await completePendingOrder(id);
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to complete pending order.");
  }
}
